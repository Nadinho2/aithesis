// Disable jszip web workers in server environments (Vercel serverless).
// Must be imported BEFORE any module that transitively imports "docx".
// "fake worker" error from jszip: https://github.com/Stuk/jszip/issues/638
process.env.JSZIP_FORCE_DISABLE_WORKER = "true";
