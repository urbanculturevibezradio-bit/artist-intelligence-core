// ============================================================
// lib/queue.ts — BullMQ worker queue scaffold
// ============================================================
import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';
import type { WorkerName, PipelineJob } from '@/types/pipeline';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Shared Redis connection
let _redisConnection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!_redisConnection) {
    _redisConnection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: false,
    });
  }
  return _redisConnection;
}

// ---- Queue factory ----
const _queues: Map<WorkerName, Queue> = new Map();

export function getQueue(name: WorkerName): Queue {
  if (!_queues.has(name)) {
    _queues.set(
      name,
      new Queue(name, {
        connection: getRedisConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 50 },
        },
      })
    );
  }
  return _queues.get(name)!;
}

// ---- Dispatcher — add job to appropriate queue ----
export async function dispatchJob(job: PipelineJob): Promise<void> {
  const queue = getQueue(job.worker);
  await queue.add(job.jobId, job.payload, {
    priority: job.priority ?? 5,
    attempts: job.attempts ?? 3,
    jobId: `${job.worker}:${job.jobId}`,
  });
  console.log(`[Queue] Dispatched ${job.worker} for job ${job.jobId}`);
}

// ---- Worker factory ----
export type WorkerProcessor<T = unknown, R = unknown> = (job: Job<T>) => Promise<R>;

export function createWorker<T = unknown, R = unknown>(
  name: WorkerName,
  processor: WorkerProcessor<T, R>,
  concurrency = 2
): Worker<T, R> {
  const worker = new Worker<T, R>(name, processor, {
    connection: getRedisConnection(),
    concurrency,
  });

  worker.on('completed', (job, result) => {
    console.log(`[Worker:${name}] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker:${name}] Job ${job?.id} failed: ${err.message}`);
  });

  return worker;
}

// ---- Queue events for monitoring ----
export function createQueueEvents(name: WorkerName): QueueEvents {
  return new QueueEvents(name, { connection: getRedisConnection() });
}

// ---- Pipeline orchestrator ----
/**
 * After audio upload, enqueue all workers in pipeline order.
 * Workers are independent but consume previous results from MongoDB.
 */
export async function enqueuePipeline(jobId: string, filePath: string): Promise<void> {
  const workers: WorkerName[] = [
    'whisper-timing',
    'melody-extraction',
    'bpm-groove',
    'style-classifier',
    'riddim-generator',
    'stem-assembler',
    'fingerprint-validator',
  ];

  for (const worker of workers) {
    await dispatchJob({
      jobId,
      worker,
      payload: { jobId, filePath },
      priority: workers.indexOf(worker) + 1,
    });
  }

  console.log(`[Queue] Full pipeline enqueued for job ${jobId}`);
}
