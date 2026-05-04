export const pickProvided = (source, allowedKeys) => {
  const output = {};
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      output[key] = source[key];
    }
  }
  return output;
};

export const updateById = async (
  client,
  table,
  id,
  data,
  { idColumn = 'id', touchUpdatedAt = true } = {},
) => {
  const entries = Object.entries(data).filter(([, value]) => value !== undefined);
  if (touchUpdatedAt) entries.push(['updated_at', new Date()]);
  if (!entries.length) {
    const existing = await client.query(`SELECT * FROM ${table} WHERE ${idColumn} = $1`, [id]);
    return existing.rows[0] || null;
  }

  const assignments = entries.map(([key], index) => `${key} = $${index + 1}`);
  const params = entries.map(([, value]) => value);
  params.push(id);

  const result = await client.query(
    `
      UPDATE ${table}
      SET ${assignments.join(', ')}
      WHERE ${idColumn} = $${params.length}
      RETURNING *
    `,
    params,
  );
  return result.rows[0] || null;
};
