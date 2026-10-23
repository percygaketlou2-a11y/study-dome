// Express 4 does not catch rejected promises from async route handlers. A
// single database error inside one (for example Prisma rejecting a malformed
// field) becomes an unhandled rejection, and on modern Node that terminates
// the whole process - a remote, unauthenticated way to take the API down.
//
// This forwards a handler's rejection to Express's error middleware instead,
// the same way a synchronous throw is already handled. Require it once,
// before any routes are created.
const Layer = require('express/lib/router/layer');

if (!Layer.prototype.handle_request.__catchesAsyncErrors) {
  Layer.prototype.handle_request = function handleRequest(req, res, next) {
    const fn = this.handle;
    if (fn.length > 3) return next(); // error-handling middleware is skipped on the normal path

    try {
      const result = fn(req, res, next);
      if (result && typeof result.then === 'function') {
        result.then(undefined, next);
      }
    } catch (err) {
      next(err);
    }
  };
  Layer.prototype.handle_request.__catchesAsyncErrors = true;
}
