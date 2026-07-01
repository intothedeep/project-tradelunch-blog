// // __tests__/helpers/db.helper.ts
// import { sequalizeP } from '../../config/database';

// export const clearDatabase = async () => {
//     await sequalizeP.query('DELETE FROM posts');
//     await sequalizeP.query('DELETE FROM categories');
//     await sequalizeP.query('DELETE FROM users');
// };

// export const seedTestData = async () => {
//     await sequalizeP.query(`
//     INSERT INTO users (id, username) VALUES
//     (1, 'testuser'),
//     (2, 'anotheruser');
//   `);

//     await sequalizeP.query(`
//     INSERT INTO categories (id, name, parent_id, level, group_id, priority) VALUES
//     (1, 'Tech', NULL, 0, 1, 100),
//     (2, 'Backend', 1, 1, 1, 100),
//     (3, 'Node.js', 2, 2, 1, 100),
//     (4, 'Frontend', 1, 1, 1, 200);
//   `);

//     await sequalizeP.query(`
//     INSERT INTO posts (id, user_id, category_id, title, slug, content, status, level, priority) VALUES
//     (101, 1, 3, 'Express Tutorial', 'express-tutorial', 'Learn Express.js', 'public', 0, 100),
//     (102, 1, 3, 'TypeScript Node', 'typescript-node', 'Using TypeScript', 'public', 0, 200),
//     (103, 1, 4, 'React Basics', 'react-basics', 'Introduction to React', 'public', 0, 100);
//   `);
// };
