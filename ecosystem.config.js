module.exports = {
  apps : [{
    script: 'app.js',
    watch: '.'
  }],

  deploy : {
    production : {
      NODE_ENV: "production",
    }
  }
};
