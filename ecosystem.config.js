module.exports = {
  apps : [{
    script: 'app.js',
    watch: '.'
  }, {
    script: './service-worker/',
    watch: ['./service-worker']
  }],

  deploy : {
    production : {
      NODE_ENV: "production",
    }
  }
};
