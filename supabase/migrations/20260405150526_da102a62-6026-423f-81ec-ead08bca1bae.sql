DELETE FROM order_items WHERE product_id IN (SELECT id FROM products);
DELETE FROM products;