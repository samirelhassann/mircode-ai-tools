// Conventional Commits — é o que o semantic-release lê para decidir a versão:
//   fix: → patch · feat: → minor · `!` ou `BREAKING CHANGE:` → major
export default { extends: ['@commitlint/config-conventional'] }
