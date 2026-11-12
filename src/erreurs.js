// L'erreur « à montrer telle quelle » : son message, en français, est affiché à la personne. Toute autre erreur est un bug, journalisé.
// Dans son propre fichier pour que chat.js et tables.js ne s'importent pas l'un l'autre.
export class ChatError extends Error {}
