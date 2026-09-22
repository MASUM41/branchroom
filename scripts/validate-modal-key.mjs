import process from 'node:process';

const modelsUrl =
  'https://masumthakkar41--ep-kimi-k3-server.us-west.modal.direct/v1/models';

function readSecret(prompt) {
  if (!process.stdin.isTTY) {
    throw new Error('Run this command in an interactive terminal.');
  }

  return new Promise((resolve, reject) => {
    let value = '';
    const wasRaw = process.stdin.isRaw;

    const finish = (error) => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(Boolean(wasRaw));
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value.trim());
    };

    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          finish(new Error('Cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish();
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        if (character >= ' ') value += character;
      }
    };

    process.stdout.write(prompt);
    process.stdin.setEncoding('utf8');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

try {
  const token = await readSecret('Modal proxy token (TOKEN_ID.TOKEN_SECRET): ');

  if (!token || !token.includes('.')) {
    console.error('The token must be the Token ID and Token Secret joined by a period.');
    process.exitCode = 1;
  } else {
    const response = await fetch(modelsUrl, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'manual',
      signal: AbortSignal.timeout(20_000),
    });

    if (response.ok) {
      const body = await response.json().catch(() => ({}));
      const models = Array.isArray(body.data)
        ? body.data.map((model) => model?.id).filter(Boolean)
        : [];
      console.log('Success: Modal accepted the proxy token.');
      console.log(models.length ? `Models: ${models.join(', ')}` : 'No model IDs were returned.');
    } else if (response.status === 404 || response.status === 405) {
      console.log('Success: Modal accepted the token, but this deployment has no /v1/models route.');
    } else if (response.status === 401) {
      console.error('Failed: Modal rejected the token. Use a Proxy Auth Token ID and Secret joined by a period.');
      process.exitCode = 1;
    } else if (response.status === 403) {
      console.error('Failed: the token was recognized, but access to this deployment was denied.');
      process.exitCode = 1;
    } else {
      console.error(`The deployment returned HTTP ${response.status}.`);
      process.exitCode = 1;
    }
  }
} catch (error) {
  console.error(`Could not validate the token: ${error.message}`);
  process.exitCode = 1;
}
