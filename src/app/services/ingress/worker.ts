import { Counter, Gauge, Histogram } from 'prom-client';
import { Job, JobsOptions, Queue, Worker } from 'bullmq';
import * as assert from 'assert';
import type { AnyBulkWriteOperation } from 'mongodb';

import { logger, slackLogger } from '../../helpers/pino';
import { pubSub, Trigger } from '../../helpers/pub-sub';

import { Network, networks } from '../network';
import { Order, OrderKind, OrderModel } from '../../models/order';
import { StateModel } from '../../models/state';
import { Token, TokenModel } from '../../models/token';

import { createQueueConnection, createWorkerConnection } from '../../helpers/bullmq';
import { createToken } from '../token';
import { excludeNull } from '../../utils/object';
import { getDate } from '../../utils/date';
import { getParsedUrl, getWebUrl } from '../../utils/url';
import { getRandomInt } from '../../utils/math';
import * as enrichQueue from '../enrich/queue';

import { Ingress } from '../../../lib/daochat-marketplace/documents.generated';
import type { Block_height, IngressQuery, IngressQueryVariables, Order_filter, Token_filter } from '../../../lib/daochat-marketplace/types.generated';

const POLL_BACKOFF_BASE = 100;
const POLL_BACKOFF_CAP = 30000;
const POLL_DELAY = 1000;
const POLL_LIMIT = 1000;

interface JobData {
  meta?: IngressQuery['_meta'];
  persist?: boolean;
  tokens_createdAt_gt?: string;
}

interface State {
  name: string;
  network: Network;
  queue: Queue;
  worker?: Worker<JobData>;
}

const jobOptions: JobsOptions = {
  attempts: Number.MAX_VALUE,
  backoff: { type: 'custom' },
  delay: POLL_DELAY,
  removeOnComplete: true,
  removeOnFail: true,
};
const states: Record<string, State> = {};

const ingressesTotal = new Counter({
  labelNames: ['network', 'status'],
  name: 'metaverse_ingresses_total',
  help: 'Total number of metaverse ingresses',
});
const ingressDurationSeconds = new Histogram({
  labelNames: ['network'],
  name: 'metaverse_ingress_duration_seconds',
  help: 'Duration of metaverse ingress in seconds',
});
const ingressTimeToRecoverySeconds = new Histogram({
  labelNames: ['network'],
  name: 'metaverse_ingress_time_to_recovery_seconds',
  help: 'Time to recovery of metaverse ingress in seconds',
  buckets: [1, 5, 30, 60, 300, 900, 1800, 3600, 7200, 10800, 14400],
});
const watchdogIndexerBlock = new Gauge({
  labelNames: ['network'],
  name: 'metaverse_watchdog_indexer_block',
  help: 'Block of the metaverse indexer',
});
const watchdogIndexerDelaySeconds = new Gauge({
  labelNames: ['network'],
  name: 'metaverse_watchdog_indexer_delay_seconds',
  help: 'Delay of metaverse indexer in seconds',
});
const watchdogIndexerError = new Gauge({
  labelNames: ['network'],
  name: 'metaverse_watchdog_indexer_error',
  help: 'Whether there is a metaverse indexer error',
});

async function process(state: State, data: IngressQuery) {
  const orders: Order[] = [];
  const tokenMap: Record<string, Token> = {};

  data.orders?.forEach((item) => {
    const order = {
      network: state.network.name,
      ...excludeNull(item),
      createdAt: getDate(item.createdAt),
      updatedAt: item.updatedAt ? getDate(item.updatedAt) : undefined,
      kind: item.kind as string as OrderKind,
      openFrom: item.openFrom ? getDate(item.openFrom) : undefined,
      openTo: item.openTo ? getDate(item.openTo) : undefined,
      token: item.token.id,
    };
    orders.push(order);

    const token: Token = createToken(state.network, item.token);
    token.order = order.id;
    tokenMap[token.id] = token;
  });

  data.tokens?.forEach((item) => {
    if (tokenMap[item.id]) return;

    const token = createToken(state.network, item);
    tokenMap[token.id] = token;
  });

  const tokens = Object.values(tokenMap);

  const [docs] = await Promise.all([
    tokens.length
      ? TokenModel.find(
        { network: state.network.name, id: { $in: tokens.map(({ id }) => id) }, enrichedAt: { $exists: true } },
        { id: 1, enrichedAt: 1, uri: 1, royalties: 1, metadata: 1 },
      ).lean<Pick<Token, 'id' | 'enrichedAt' | 'uri' | 'royalties' | 'metadata'>[]>()
      : undefined,
    tokens.length
      ? TokenModel.bulkWrite(
        tokens.map<AnyBulkWriteOperation<Token>>(({ id, ...token }) => ({
          updateOne: {
            filter: { network: state.network.name, id },
            update: { $set: token },
            upsert: true,
          },
        })),
        { ordered: false },
      )
      : undefined,
    orders.length
      ? OrderModel.bulkWrite(
        orders.map<AnyBulkWriteOperation<Order>>(({ id, ...order }) => ({
          updateOne: {
            filter: { network: state.network.name, id },
            update: { $set: order },
            upsert: true,
          },
        })),
        { ordered: false },
      )
      : undefined,
  ]);

  const promises: Promise<unknown>[] = [];
  const map = docs ? Object.fromEntries(docs.map((doc) => [doc.id, doc])) : {};

  const missing = tokens.filter((token) => !map[token.id]);
  if (missing.length) {
    promises.push(
      enrichQueue.enqueue(...missing.map((token) => ({
        orders: orders.filter((order) => order.token === token.id),
        token,
      }))),
    );
  }

  orders.forEach((order) => {
    if (!map[order.token as string]) return; // deligate to enrich

    const token = { ...tokenMap[order.token as string], ...map[order.token as string] };

    slackLogger.info({ order, token, imageUrl: getParsedUrl(token.metadata?.image), webUrl: getWebUrl(token) }, 'ingress order');

    promises.push(
      pubSub.publish(Trigger.OrderUpdated, { ...order, token })
    );

    if (token.order === order.id) {
      promises.push(
        pubSub.publish(Trigger.TokenUpdated, { ...token, order })
      );
    }
  });

  await Promise.all(promises);
}

async function poll(state: State, data: JobData): Promise<JobData> {
  const { meta, tokens_createdAt_gt } = data;
  const nextData = { ...data, persist: false };

  let block: Block_height | undefined;
  let orders_where: Order_filter = {};
  let orders_first = POLL_LIMIT;
  let tokens_where: Token_filter = {};
  let tokens_first = POLL_LIMIT;
  do {
    const data = await state.network.indexer().request<IngressQuery, IngressQueryVariables>(Ingress, {
      block,
      orders_include: orders_first > 0,
      orders_where: { _change_block: { number_gte: meta ? meta.block.number + 1 : 0 }, ...orders_where },
      orders_first,
      tokens_include: tokens_first > 0,
      tokens_where: { createdAt_gt: tokens_createdAt_gt, ...tokens_where, ...state.network.ingressWhere },
      tokens_first,
    });

    assert.ok(data._meta);

    if (data.orders?.length || data.tokens?.length) {
      await process(state, data);

      if (!block) {
        block = { number: data._meta.block.number };
      }

      if (data.orders?.length) {
        orders_where = { id_gt: data.orders[data.orders.length - 1].id };
      }

      if (data.tokens?.length) {
        nextData.tokens_createdAt_gt = data.tokens.reduce((acc, cur) => Math.max(acc, +(cur.createdAt || 0)), +(nextData.tokens_createdAt_gt || 0)).toString(); // @todo replace by createdBlock
        tokens_where = { id_gt: data.tokens[data.tokens.length - 1].id };
      }

      nextData.persist = true;
    }

    nextData.meta = data._meta;

    if (data.orders?.length || 0 < orders_first) orders_first = 0;
    if (data.tokens?.length || 0 < tokens_first) tokens_first = 0;
  } while (orders_first || tokens_first);

  return nextData;
}

async function processor(state: State, { data }: Job<JobData>) {
  const labels = { network: state.network.name };

  const ingressDurationTimer = ingressDurationSeconds.startTimer(labels);

  const nextData = await poll(state, data);
  const now = Date.now();

  ingressDurationTimer();

  await Promise.all([
    nextData.persist &&
      StateModel.updateOne(
        { key: state.name },
        { $set: { value: nextData }, $inc: { __v: 1 } },
        { upsert: true }
      ),
    state.queue.add('*', nextData, jobOptions),
  ]);

  if (nextData.meta) {
    watchdogIndexerBlock.labels(labels).set(nextData.meta.block.number);
    watchdogIndexerError.labels(labels).set(nextData.meta.hasIndexingErrors ? 1 : 0);

    if (nextData.meta.block !== data.meta?.block && nextData.meta.block.timestamp) {
      watchdogIndexerDelaySeconds.labels(labels).set(now / 1000 - nextData.meta.block.timestamp);
    }
  }
}

function timing({ timestamp }: Job<JobData>) {
  return {
    secondsElapsed: (Date.now() - timestamp) / 1000,
    timestamp: new Date(timestamp),
  };
}

async function startNetwork(network: Network) {
  if (!network.ingressEnabled) return;

  const name = `ingress:${network.name}`;
  const state: State = states[network.name] = {
    name,
    network,
    queue: new Queue<JobData>(name, { connection: createQueueConnection() }),
  };

  await state.queue.waitUntilReady();

  if (!await state.queue.getJobCountByTypes('wait', 'delayed', 'paused', 'active', 'failed')) {
    const extstate = await StateModel.findOne(
      { key: state.name },
      { value: 1 },
      { lean: true }
    );
    const job = await state.queue.add('*', extstate?.value || {}, jobOptions);
    logger.info(job.asJSON(), 'created ingress job');
  }

  state.worker = new Worker<JobData>(name, processor.bind(null, state), {
    connection: createWorkerConnection(),
    settings: { backoffStrategy: (attempts) => getRandomInt(0, Math.min(POLL_BACKOFF_CAP, POLL_BACKOFF_BASE * 2 ** attempts)) },
  });
  state.worker.on('failed', function onFailed(job, err) {
    ingressesTotal.inc({ network: state.network.name, status: 'fail' });
    logger.error({ network: state.network.name, ...job && timing(job), err }, 'failed ingress');
  });
  state.worker.on('completed', function onCompleted(job) {
    ingressesTotal.inc({ network: state.network.name, status: 'success' });

    if (job.attemptsMade > 1) {
      const time = timing(job);

      ingressTimeToRecoverySeconds.labels({ network: state.network.name }).observe(time.secondsElapsed);
      logger.info({ network: state.network.name, ...time }, 'recovered ingress');
    }
  });

  await state.worker.waitUntilReady();
}

export async function start() {
  await enrichQueue.start();
  await Promise.all(networks.map(startNetwork));
}

async function stopNetwork(network: Network) {
  if (!states[network.name]) return;

  const state = states[network.name];

  await state.worker?.close();
  await state.queue.close();
}

export async function stop() {
  await Promise.all(networks.map(stopNetwork));
  await enrichQueue.stop();
}
