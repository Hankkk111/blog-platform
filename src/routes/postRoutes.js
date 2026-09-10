const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  listPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  addComment,
  addReply,
  deleteComment,
  getTrendingPosts,
} = require('../controllers/postController');

const router = express.Router();

/**
 * @openapi
 * /api/posts:
 *   get:
 *     summary: List posts (paginated, filterable by tag, searchable by text)
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: size
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: tag
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200: { description: A page of posts }
 *   post:
 *     summary: Create a post
 *     tags: [Posts]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, body]
 *             properties:
 *               title: { type: string }
 *               body: { type: string }
 *               tags: { type: array, items: { type: string } }
 *     responses:
 *       201: { description: Post created }
 */
router.get('/', listPosts);
router.post('/', requireAuth, createPost);

/**
 * @openapi
 * /api/posts/trending:
 *   get:
 *     summary: Get the most-commented posts, ranked by an aggregation pipeline
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 5 }
 *     responses:
 *       200: { description: Posts ranked by engagement }
 */
router.get('/trending', getTrendingPosts);

/**
 * @openapi
 * /api/posts/{id}:
 *   parameters:
 *     - in: path
 *       name: id
 *       required: true
 *       schema: { type: string }
 *   get:
 *     summary: Get a single post (including its full comment thread)
 *     tags: [Posts]
 *     responses:
 *       200: { description: The post }
 *       404: { description: Not found }
 *   put:
 *     summary: Update a post (author only)
 *     tags: [Posts]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               body: { type: string }
 *               tags: { type: array, items: { type: string } }
 *     responses:
 *       200: { description: Updated post }
 *       403: { description: Not the post's author }
 *   delete:
 *     summary: Delete a post (author only)
 *     tags: [Posts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       204: { description: Deleted }
 *       403: { description: Not the post's author }
 */
router.get('/:id', getPostById);
router.put('/:id', requireAuth, updatePost);
router.delete('/:id', requireAuth, deletePost);

/**
 * @openapi
 * /api/posts/{id}/comments:
 *   parameters:
 *     - in: path
 *       name: id
 *       required: true
 *       schema: { type: string }
 *   post:
 *     summary: Add a comment to a post
 *     tags: [Comments]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               body: { type: string }
 *     responses:
 *       201: { description: Comment added }
 */
router.post('/:id/comments', requireAuth, addComment);

/**
 * @openapi
 * /api/posts/{id}/comments/{commentId}:
 *   parameters:
 *     - in: path
 *       name: id
 *       required: true
 *       schema: { type: string }
 *     - in: path
 *       name: commentId
 *       required: true
 *       schema: { type: string }
 *   delete:
 *     summary: Delete a comment (comment author only)
 *     tags: [Comments]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       204: { description: Deleted }
 *       403: { description: Not the comment's author }
 */
router.delete('/:id/comments/:commentId', requireAuth, deleteComment);

/**
 * @openapi
 * /api/posts/{id}/comments/{commentId}/replies:
 *   parameters:
 *     - in: path
 *       name: id
 *       required: true
 *       schema: { type: string }
 *     - in: path
 *       name: commentId
 *       required: true
 *       schema: { type: string }
 *   post:
 *     summary: Reply to a comment
 *     tags: [Comments]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               body: { type: string }
 *     responses:
 *       201: { description: Reply added }
 */
router.post('/:id/comments/:commentId/replies', requireAuth, addReply);

module.exports = router;
