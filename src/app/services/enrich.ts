import { BulkWriteOperation } from 'mongodb';
import { Histogram } from 'prom-client';
import { Queue, Worker } from 'bullmq';
import * as assert from 'assert';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import fetch, { Response } from 'node-fetch';

import { OfferModel, Offer } from '../models/offer';

import { BuffereredQueue } from '../utils/buffered-queue';
import { logger } from '../helpers/pino';
import { redis } from '../helpers/redis';
import { parseSchema } from '../utils/url';

import { ipfsGatewayUri } from '../../config';

export const JOB_NAME = 'enrich';
export const QUEUE_NAME = 'enrich';
export const WRITER_TIMEOUT = 1000;

const durationSeconds = new Histogram({
  name: 'nft_enrich_duration_seconds',
  help: 'Duration of NFT enrich in seconds',
});

const writer = new BuffereredQueue<BulkWriteOperation<Offer>>(
  async (operations) => OfferModel.bulkWrite(operations).then(),
  WRITER_TIMEOUT,
);

interface JobData {
  id: string;
  token_uri: string;
}
export const queue = new Queue<JobData>(QUEUE_NAME, { connection: redis });

export const start = async () => {
  const httpAgent = new http.Agent({ keepAlive: true });
  const httpsAgent = new https.Agent({ keepAlive: true });

  new Worker<JobData>(queue.name, async function (job) {
    const stopTimer = durationSeconds.startTimer();

    const { id, token_uri } = job.data;

    let response: Response;
    const schema = parseSchema(token_uri);
    switch (schema) {
      case 'http':
        response = await fetch(token_uri, { agent: httpAgent });
        break;
      case 'https':
        response = await fetch(token_uri, { agent: httpsAgent });
        break;
      case 'ipfs': {
        const url = path.join(ipfsGatewayUri, 'ipns', token_uri.substr('ipfs://'.length));
        response = await fetch(url, { agent: httpsAgent });
        break; }
      default:
        logger.debug(job, `unsupported schema ${schema}`);
        return;
    }

    assert.ok(response.ok); // @todo: validate metadata

    writer.enqueue({
      updateOne: {
        filter: { id },
        update: { $set: { token_metadata: await response.json() } },
      },
    });

    stopTimer();
  });
};

export const stop = async () => {
  await queue.close();
  await writer.flush();
};
