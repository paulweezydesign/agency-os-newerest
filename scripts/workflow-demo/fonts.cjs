// Local demo only: removes Google Fonts network dependency, not a production build proof.
module.exports = {
  'https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap': "@font-face { font-family: 'Geist'; src: local('Arial'); font-weight: 100 900; }",
  'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap': "@font-face { font-family: 'Geist Mono'; src: local('Courier New'); font-weight: 100 900; }",
};
