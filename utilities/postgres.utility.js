const postgres = require("postgres");

exports.sql = postgres(
    process.env.POSTGRES_CONNECTION_STRING,
    {
        transform: {
            undefined: null
        }
    }
);