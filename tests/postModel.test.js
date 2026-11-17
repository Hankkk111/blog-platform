const mongoose = require('mongoose');
const Post = require('../src/models/Post');

// Pure model tests: documents are built and validated in memory, so this
// file needs no MongoDB instance.
function buildPost(tags) {
  return new Post({
    title: 'Hello',
    body: 'World',
    author: new mongoose.Types.ObjectId(),
    authorUsername: 'alice',
    tags,
  });
}

describe('Post tags normalization', () => {
  test('lowercases, trims and drops empty tags', () => {
    const post = buildPost(['  React ', 'JavaScript', '   ']);

    expect(post.tags.toObject()).toEqual(['react', 'javascript']);
    expect(post.validateSync()).toBeUndefined();
  });

  test('accepts a single tag string', () => {
    const post = buildPost(' Node ');

    expect(post.tags.toObject()).toEqual(['node']);
  });

  test('treats null as no tags', () => {
    const post = buildPost(['react']);
    post.tags = null;

    expect(post.tags.toObject()).toEqual([]);
  });

  test('still reports a non-string tag as a validation error', () => {
    let post;
    expect(() => {
      post = buildPost([{ name: 'react' }]);
    }).not.toThrow();

    const err = post.validateSync();
    expect(err).toBeDefined();
    expect(err.name).toBe('ValidationError');
  });
});
