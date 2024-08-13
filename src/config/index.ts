import * as env from 'env-var';

export const adminPort = env.get('ADMIN_PORT').asIntPositive();
export const apolloDebug = env.get('APOLLO_DEBUG').asBool();
export const apolloIntrospection = env.get('APOLLO_INTROSPECTION').asBool();
export const appPort = env.get('APP_PORT').default(4000).asIntPositive();
export const databaseDebug = env.get('DATABASE_DEBUG').asBool();
export const databaseUrl = env.get('DATABASE_URL').default('mongodb://localhost/metaverse').asUrlString();
export const environment = env.get('NODE_ENV').default('development').asString();
export const ipfsGatewayUrl = env.get('IPFS_GATEWAY_URL').default('https://gateway.pinata.cloud/ipfs/').asUrlObject();
export const redisUrl = env.get('REDIS_URL').default('redis://localhost').asUrlString();
export const slackWebhookUrl = env.get('SLACK_WEBHOOK_URL').asUrlString();
export const wertPrivateKey = env.get('WERT_PRIVATE_KEY').asString();
export const wertPublicKeyId = env.get('WERT_PUBLIC_KEY_ID').asString();

export const isProduction = environment === 'production';
export const webUrl = isProduction ? 'https://daochat.social/' : 'https://staging.daochat.social/';
