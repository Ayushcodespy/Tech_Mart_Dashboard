import { deleteStoredFile } from './upload.js';

const normalizedIds = (productIds) =>
  [...new Set((productIds || []).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];

export const deleteProductsByIds = async (client, productIds) => {
  const ids = normalizedIds(productIds);
  if (!ids.length) {
    return { deletedCount: 0, filePaths: [] };
  }

  const fileRows = await client.query(
    `
      SELECT DISTINCT image_url
      FROM (
        SELECT image_url
        FROM products
        WHERE id = ANY($1::int[])

        UNION

        SELECT image_url
        FROM product_images
        WHERE product_id = ANY($1::int[])
      ) AS files
      WHERE image_url IS NOT NULL
    `,
    [ids],
  );

  await client.query('DELETE FROM cart_items WHERE product_id = ANY($1::int[])', [ids]);
  await client.query('DELETE FROM wishlist_items WHERE product_id = ANY($1::int[])', [ids]);
  await client.query('UPDATE order_items SET product_id = NULL WHERE product_id = ANY($1::int[])', [ids]);
  await client.query('DELETE FROM inventory_logs WHERE product_id = ANY($1::int[])', [ids]);

  const deleted = await client.query('DELETE FROM products WHERE id = ANY($1::int[]) RETURNING id', [ids]);

  return {
    deletedCount: deleted.rows.length,
    filePaths: fileRows.rows.map((row) => row.image_url).filter(Boolean),
  };
};

export const deleteProductFiles = async (filePaths) => {
  await Promise.all((filePaths || []).map((filePath) => deleteStoredFile(filePath)));
};
