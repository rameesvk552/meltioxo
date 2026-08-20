const { sequelize } = require('./models');

async function main() {
  try {
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'raw_materials' AND column_name = 'category'
    `);
    console.log('--- Column Details ---');
    console.log(columns);
  } catch (error) {
    console.error('Error querying DB:', error);
  } finally {
    await sequelize.close();
  }
}

main();
