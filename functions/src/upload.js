const Busboy = require("busboy");
const { MAX_UPLOAD_BYTES } = require("./config");

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      const error = new Error("Expected multipart/form-data");
      error.status = 400;
      error.code = "unsupported_content_type";
      reject(error);
      return;
    }

    const busboy = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 10 },
    });

    const fields = {};
    let fileBuffer = null;
    let fileMime = null;
    let fileName = null;
    let fileSize = 0;
    let fileTruncated = false;

    busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
      if (typeof filename === "object" && filename !== null) {
        fileName = filename.filename;
        fileMime = filename.mimeType;
      } else {
        fileName = filename;
        fileMime = mimetype;
      }
      const chunks = [];
      file.on("data", (data) => {
        fileSize += data.length;
        chunks.push(data);
      });
      file.on("limit", () => {
        fileTruncated = true;
      });
      file.on("end", () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    busboy.on("field", (name, val) => {
      fields[name] = val;
    });

    busboy.on("error", (err) => {
      const error = new Error(err.message || "Multipart error");
      error.status = 400;
      error.code = "bad_multipart";
      reject(error);
    });

    busboy.on("finish", () => {
      if (fileTruncated) {
        const error = new Error("File too large");
        error.status = 413;
        error.code = "file_too_large";
        reject(error);
        return;
      }
      if (!fileBuffer) {
        const error = new Error("Missing image");
        error.status = 400;
        error.code = "missing_image";
        reject(error);
        return;
      }
      resolve({ fields, file: { buffer: fileBuffer, mimeType: fileMime, filename: fileName, size: fileSize } });
    });

    req.on("aborted", () => {
      const error = new Error("Request aborted");
      error.status = 400;
      error.code = "bad_multipart";
      reject(error);
    });
    req.on("error", (err) => {
      const error = new Error(err.message || "Request error");
      error.status = 400;
      error.code = "bad_multipart";
      reject(error);
    });
    req.pipe(busboy);
  });
}

function parseJsonBody(req) {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("application/json")) return null;
  if (!req.body || typeof req.body !== "object") {
    const error = new Error("Invalid JSON body");
    error.status = 400;
    error.code = "bad_json";
    throw error;
  }
  return req.body;
}

module.exports = { parseMultipart, parseJsonBody };
