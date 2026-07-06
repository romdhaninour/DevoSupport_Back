const ExcelJS = require('exceljs');
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Devices');

sheet.columns = [
  { header: 'Name', key: 'name', width: 30 },
  { header: 'Type', key: 'type', width: 20 },
  { header: 'Serial Number', key: 'serialNumber', width: 25 },
  { header: 'Status', key: 'status', width: 18 },
  { header: 'Department', key: 'department', width: 20 },
  { header: 'Owner', key: 'owner', width: 20 },
  { header: 'Location', key: 'location', width: 20 },
];

sheet.addRow({
  name: 'excel',
  type: 'Laptop',
  serialNumber: 'AZERTY-14562',
  status: 'Disponible',
  department: 'Non spécifié',
  owner: 'À définir',
  location: 'À définir',
});

sheet.addRow({
  name: 'Workstation 02',
  type: 'Desktop',
  serialNumber: 'BT-9087',
  status: 'Maintenance',
  department: 'Support',
  owner: 'Jean Dupont',
  location: 'Bureau 12',
});

workbook.xlsx.writeFile('device-import-template.xlsx').then(() => {
  console.log('Created device-import-template.xlsx');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
