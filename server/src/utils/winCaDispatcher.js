const tls = require('tls');
const { Agent } = require('undici');

// Node's fetch (undici) doesn't read the Windows certificate store the way
// Postman/browsers do. On machines where an antivirus or corporate proxy does
// TLS inspection with a root cert that's only trusted at the OS level, plain
// `fetch` fails with SELF_SIGNED_CERT_IN_CHAIN even though the endpoint is fine.
// We merge Node's default trusted roots with the Windows trust store once,
// lazily, and reuse the resulting Agent as a dispatcher for outbound calls.
let winAgentPromise = null;
function getWinCaDispatcher() {
  if (process.platform !== 'win32') return undefined;
  if (!winAgentPromise) {
    winAgentPromise = new Promise((resolve) => {
      const certs = [];
      try {
        const winca = require('win-ca');
        winca({ format: winca.der2.pem, ondata: (c) => certs.push(c), onend: () => resolve(certs) });
      } catch {
        resolve(certs);
      }
    }).then((certs) => new Agent({ connect: { ca: [...tls.rootCertificates, ...certs] } }));
  }
  return winAgentPromise;
}

module.exports = { getWinCaDispatcher };
