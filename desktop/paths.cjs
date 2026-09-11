const path = require("node:path");

function isGameURL(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "polaroid:" &&
      url.host === "game" &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function assetPath(root, value) {
  if (!isGameURL(value)) return null;
  let name;
  try {
    name = decodeURIComponent(new URL(value).pathname);
  } catch {
    return null;
  }
  // Reject Windows separators, alternate streams and encoded traversal too.
  if (/[\\\0:]/.test(name) || name.split("/").includes("..")) return null;
  const target = path.resolve(
    root,
    "." + (name === "/" ? "/index.html" : name),
  );
  const relative = path.relative(root, target);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative)
    ? target
    : null;
}
module.exports = { isGameURL, assetPath };
