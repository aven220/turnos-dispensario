const path = require('path');

module.exports = {
  apps: [
    {
      name: 'turnos-dispensario',
      cwd: path.join(__dirname, '../../backend'),
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
