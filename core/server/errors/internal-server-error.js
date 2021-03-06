// # Internal Server Error
// Custom error class with status code and type prefilled.

function InternalServerError(message, context, help) {
    this.message = message;
    this.stack = new Error().stack;
    this.statusCode = 500;
    this.errorType = this.name;
    this.context = context;
    this.help = help;
}

InternalServerError.prototype = Object.create(Error.prototype);
InternalServerError.prototype.name = 'InternalServerError';

module.exports = InternalServerError;
