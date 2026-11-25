import { roomRequest } from './room.js';

export default {
  fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/api/rooms' || /^\/api\/rooms\/[A-Z0-9]{8}$/.test(path)) {
      return roomRequest(request, env.DB);
    }
    return new Response('Not found', {status: 404});
  }
};
