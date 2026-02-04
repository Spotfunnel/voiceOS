/**
 * Main Entry Point - Layer 2: Orchestration Service
 * 
 * Orchestration service for SpotFunnel Voice AI Platform
 */

import Fastify from 'fastify';
import { OrchestrationEngine } from './services/orchestration-engine.js';
import { ConfigService } from './config/config-service.js';
import { VoiceCoreClient } from './api/voice-core-client.js';
import { eventBus } from './events/event-bus.js';
import { EventType } from './models/config.model.js';
import type { TenantConfig } from './models/config.model.js';
import { v4 as uuidv4 } from 'uuid';
import { initializeDatabase, db } from './database/db.js';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    } : undefined,
  },
});

// Initialize database connection
initializeDatabase();

// Initialize services
const voiceCoreClient = new VoiceCoreClient({
  endpoint: process.env.VOICE_CORE_ENDPOINT || 'http://localhost:8000',
  useGrpc: process.env.VOICE_CORE_USE_GRPC === 'true',
});

const orchestrationEngine = new OrchestrationEngine(voiceCoreClient);
const configService = new ConfigService();

// Health check endpoint
fastify.get('/health', async () => {
  const voiceCoreHealthy = await voiceCoreClient.healthCheck();
  const databaseHealthy = await db.healthCheck();
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      voice_core: voiceCoreHealthy ? 'healthy' : 'unhealthy',
      database: databaseHealthy ? 'healthy' : 'unhealthy',
    },
  };
});

// Start conversation endpoint
fastify.post<{
  Body: {
    tenant_id: string;
    conversation_id?: string;
    config: TenantConfig;
  };
}>('/api/v1/conversations/start', async (request, reply) => {
  const { tenant_id, conversation_id, config } = request.body;

  // Validate conversation_id or generate one
  const convId = conversation_id || uuidv4();

  try {
    // Validate configuration
    const validation = configService.validate(config);
    if (!validation.valid) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Configuration validation failed',
          details: validation.errors,
        },
      });
    }

    // Load and validate configuration
    const validatedConfig = await configService.load(config);

    // Start conversation (async, don't wait)
    orchestrationEngine.startConversation(tenant_id, convId, validatedConfig)
      .catch((error) => {
        fastify.log.error({ error, tenant_id, conversation_id: convId }, 'Error starting conversation');
      });

    return {
      conversation_id: convId,
      status: 'started',
    };
  } catch (error) {
    fastify.log.error({ error, tenant_id }, 'Error starting conversation');
    return reply.code(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
});

// Get conversation events (event sourcing)
fastify.get<{
  Params: {
    conversation_id: string;
  };
}>('/api/v1/conversations/:conversation_id/events', async (request, reply) => {
  const { conversation_id } = request.params;

  const events = eventBus.getConversationEvents(conversation_id);

  return {
    conversation_id,
    events,
    count: events.length,
  };
});

// Load configuration from file endpoint
fastify.post<{
  Body: {
    file_path: string;
  };
}>('/api/v1/config/load', async (request, reply) => {
  const { file_path } = request.body;

  try {
    const config = await configService.loadFromFile(file_path);
    return {
      config,
      valid: true,
    };
  } catch (error) {
    return reply.code(400).send({
      error: {
        code: 'CONFIG_LOAD_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    });
  });
});

// Validate configuration endpoint
fastify.post<{
  Body: {
    config: TenantConfig;
  };
}>('/api/v1/config/validate', async (request, reply) => {
  const { config } = request.body;

  const validation = configService.validate(config);
  
  if (!validation.valid) {
    return reply.code(400).send({
      valid: false,
      errors: validation.errors,
    });
  }

  // Also validate DAG
  const dagValidation = configService.validateDAG(config.objectives);
  
  return {
    valid: validation.valid && dagValidation.valid,
    errors: [...validation.errors, ...dagValidation.errors],
  };
});

// Load configuration from database endpoint
fastify.get<{
  Params: {
    tenant_id: string;
  };
  Querystring: {
    version?: string;
  };
}>('/api/v1/config/:tenant_id', async (request, reply) => {
  const { tenant_id } = request.params;
  const { version } = request.query;

  try {
    const config = await configService.loadFromDatabase(tenant_id, version);
    return {
      tenant_id,
      version: version || 'latest',
      config,
    };
  } catch (error) {
    return reply.code(404).send({
      error: {
        code: 'CONFIG_NOT_FOUND',
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
});

// Save configuration to database endpoint
fastify.post<{
  Body: {
    tenant_id: string;
    config: TenantConfig;
    version: string;
  };
}>('/api/v1/config', async (request, reply) => {
  const { tenant_id, config, version } = request.body;

  try {
    await configService.saveToDatabase(tenant_id, config, version);
    return {
      tenant_id,
      version,
      status: 'saved',
    };
  } catch (error) {
    return reply.code(400).send({
      error: {
        code: 'CONFIG_SAVE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
});

// List configuration versions endpoint
fastify.get<{
  Params: {
    tenant_id: string;
  };
}>('/api/v1/config/:tenant_id/versions', async (request, reply) => {
  const { tenant_id } = request.params;

  try {
    const versions = await configService.listConfigVersions(tenant_id);
    return {
      tenant_id,
      versions,
    };
  } catch (error) {
    return reply.code(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
});

// Graceful shutdown
const shutdown = async () => {
  fastify.log.info('Shutting down gracefully...');
  await db.close();
  await fastify.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
const start = async () => {
  try {
    // Verify database connection
    const dbHealthy = await db.healthCheck();
    if (!dbHealthy) {
      fastify.log.error('Database connection failed. Please check your database configuration.');
      process.exit(1);
    }
    fastify.log.info('Database connection established');

    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    fastify.log.info(`Orchestration service listening on ${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    await db.close();
    process.exit(1);
  }
};

start();
