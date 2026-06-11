// PM2 — proceso principal + logrotate
// Instalar:  pm2 install pm2-logrotate
//            pm2 start ecosystem.config.cjs --env production
//            pm2 save && pm2 startup
module.exports = {
  apps: [
    {
      name: "helpdesk-backend",
      script: "src/server.js",
      cwd: "/opt/helpdesk/backend",
      instances: 1,                 // subir a "max" si se quiere cluster
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: "512M",
      kill_timeout: 8000,
      env: { NODE_ENV: "production" },
      out_file: "/var/log/helpdesk/out.log",
      error_file: "/var/log/helpdesk/err.log",
      merge_logs: true,
      time: true,
    },
  ],

  // Configuración recomendada para pm2-logrotate (aplicar manualmente):
  //   pm2 set pm2-logrotate:max_size 20M
  //   pm2 set pm2-logrotate:retain 14
  //   pm2 set pm2-logrotate:compress true
  //   pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
  //   pm2 set pm2-logrotate:rotateInterval '0 0 * * *'   # diario
};
