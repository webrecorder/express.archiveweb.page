module.exports = {
  mode: 'jit',
  
  purge: {
    content: ['./*.html', './src/*.js'],
    options: {
      safelist: [
        /data-theme$/,
      ]
    },
  },
  plugins: [
    require('@tailwindcss/forms')
  ],
  extract: {
    include: ['./src/*.js'],
  },
};
