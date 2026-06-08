'use strict';

const readline = require('readline');

/**
 * Create a line-buffered input controller over stdin. This works under an
 * interactive TTY and also under piped/redirected input (where many lines may
 * arrive at once) without dropping buffered lines between prompts.
 */
function createInterface() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const lineQueue = [];
  const waiters = [];
  let closed = false;

  rl.on('line', (line) => {
    const waiter = waiters.shift();
    if (waiter) {
      waiter(line);
    } else {
      lineQueue.push(line);
    }
  });

  rl.on('close', () => {
    closed = true;
    while (waiters.length) {
      waiters.shift()('');
    }
  });

  return {
    ask(question) {
      process.stdout.write(question);
      return new Promise((resolve) => {
        if (lineQueue.length) {
          resolve(lineQueue.shift());
        } else if (closed) {
          resolve('');
        } else {
          waiters.push(resolve);
        }
      });
    },
    close() {
      rl.close();
    },
  };
}

/**
 * Prompt for a free-text value with optional default and validation.
 * @param {ReturnType<typeof createInterface>} io
 * @param {object} field
 * @param {string} field.label    Human-readable prompt.
 * @param {string} [field.default] Default value applied on empty input.
 * @param {RegExp} [field.pattern] Validation pattern.
 * @param {string} [field.hint]    Shown when validation fails.
 * @param {boolean} [field.optional] Allow empty without default.
 */
async function promptValue(io, field) {
  const suffix = field.default ? ` [${field.default}]` : field.optional ? ' (optional)' : '';
  // Loop until we get a value that satisfies the field constraints.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const raw = (await io.ask(`${field.label}${suffix}: `)).trim();
    const value = raw || field.default || '';

    if (!value) {
      if (field.optional) {
        return '';
      }
      console.log('  ! A value is required.');
      continue;
    }

    if (field.pattern && !field.pattern.test(value)) {
      console.log(`  ! Invalid value. ${field.hint || 'Please try again.'}`);
      continue;
    }

    return value;
  }
}

/**
 * Prompt the user to pick one option from a list by number.
 * @param {ReturnType<typeof createInterface>} io
 * @param {string} label
 * @param {Array<{key: string, title: string, description?: string}>} options
 */
async function promptChoice(io, label, options) {
  console.log(`\n${label}`);
  options.forEach((option, index) => {
    const desc = option.description ? ` — ${option.description}` : '';
    console.log(`  ${index + 1}) ${option.title}${desc}`);
  });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const raw = (await io.ask(`Select 1-${options.length}: `)).trim();
    const index = Number(raw);
    if (Number.isInteger(index) && index >= 1 && index <= options.length) {
      return options[index - 1];
    }
    console.log('  ! Enter a number from the list.');
  }
}

/**
 * Prompt the user to pick one or more options from a list by number.
 * Accepts a comma/space separated list of indices, e.g. "1,3" or "1 2 3".
 * @param {ReturnType<typeof createInterface>} io
 * @param {string} label
 * @param {Array<{key: string, title: string, description?: string}>} options
 * @returns {Promise<Array<object>>} the selected options (>= 1)
 */
async function promptMultiChoice(io, label, options) {
  console.log(`\n${label}`);
  options.forEach((option, index) => {
    const desc = option.description ? ` — ${option.description}` : '';
    console.log(`  ${index + 1}) ${option.title}${desc}`);
  });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const raw = (await io.ask(`Select one or more 1-${options.length} (comma separated): `)).trim();
    const indices = raw
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);

    const valid =
      indices.length > 0 &&
      indices.every((index) => Number.isInteger(index) && index >= 1 && index <= options.length);

    if (valid) {
      const unique = [...new Set(indices)];
      return unique.map((index) => options[index - 1]);
    }
    console.log('  ! Enter one or more numbers from the list, separated by commas.');
  }
}

/**
 * Prompt for a yes/no confirmation.
 */
async function promptConfirm(io, label, defaultYes = true) {
  const suffix = defaultYes ? ' [Y/n]' : ' [y/N]';
  const raw = (await io.ask(`${label}${suffix}: `)).trim().toLowerCase();
  if (!raw) {
    return defaultYes;
  }
  return raw === 'y' || raw === 'yes';
}

module.exports = {
  createInterface,
  promptValue,
  promptChoice,
  promptMultiChoice,
  promptConfirm,
};
