'use strict';

const { createEventStore } = require('./engine/event-store');
const { createObservability } = require('./engine/observability');

function createObservabilityHandler(opts) {
  const { skillDir, tasksDir, getState, engine } = opts;

  const eventStore = createEventStore(
    require('path').join(skillDir, '.aic', 'events.jsonl')
  );

  const obs = createObservability({
    skillDir,
    tasksDir,
    getState,
    getEventStore: () => eventStore,
    getContracts: () => ({}),
  });

  function handleObservability(req, res, pathname, send) {
    // GET /api/observability/runtime
    if (req.method === 'GET' && pathname === '/api/observability/runtime') {
      const snapshot = obs.buildRuntimeSnapshot();
      return send(res, 200, snapshot);
    }

    // GET /api/observability/workers/:id
    const workerMatch = pathname.match(/^\/api\/observability\/workers\/([^/]+)$/);
    if (req.method === 'GET' && workerMatch) {
      const detail = obs.getWorkerDetail(workerMatch[1]);
      if (!detail) return send(res, 404, { error: 'worker not found' });
      return send(res, 200, detail);
    }

    // GET /api/observability/events
    if (req.method === 'GET' && pathname === '/api/observability/events') {
      const params = req.url.searchParams;
      const limit = parseInt(params.get('limit') || '50', 10);
      const taskId = params.get('taskId') || undefined;
      const phase = params.get('phase') || undefined;
      const type = params.get('type') || undefined;
      const result = eventStore.query({ limit, taskId, phase, type });
      return send(res, 200, result);
    }

    // GET /api/observability/pipeline/:taskId
    const pipelineMatch = pathname.match(/^\/api\/observability\/pipeline\/([^/]+)$/);
    if (req.method === 'GET' && pipelineMatch) {
      const detail = obs.getTaskPipeline(pipelineMatch[1]);
      if (!detail) return send(res, 404, { error: 'task not found' });
      return send(res, 200, detail);
    }

    // GET /api/observability/knowledge/:taskId
    const knowledgeMatch = pathname.match(/^\/api\/observability\/knowledge\/([^/]+)$/);
    if (req.method === 'GET' && knowledgeMatch) {
      const detail = obs.getTaskKnowledge(knowledgeMatch[1]);
      if (!detail) return send(res, 404, { error: 'no knowledge for task' });
      return send(res, 200, detail);
    }

    // GET /api/observability/tasks/:taskId/artifacts
    const artifactMatch = pathname.match(/^\/api\/observability\/tasks\/([^/]+)\/artifacts$/);
    if (req.method === 'GET' && artifactMatch) {
      const detail = obs.getTaskArtifacts(artifactMatch[1]);
      if (!detail) return send(res, 404, { error: 'task not found' });
      return send(res, 200, detail);
    }

    return false; // not handled
  }

  return { handleObservability, eventStore };
}

module.exports = { createObservabilityHandler };
