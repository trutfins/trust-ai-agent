export default {
  async fetch(req, env, ctx) {
    // Pass-through: يمرّر الطلب إلى الأصل (Pages) مباشرة.
    return fetch(req);
  }
};
