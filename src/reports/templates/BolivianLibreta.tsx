import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

// ==========================================
// 1. UTILIDAD: NÚMEROS A LETRAS (Aislada para portabilidad)
// ==========================================
const UNIDADES = [
  '',
  'UNO ',
  'DOS ',
  'TRES ',
  'CUATRO ',
  'CINCO ',
  'SEIS ',
  'SIETE ',
  'OCHO ',
  'NUEVE ',
];
const DECENAS = [
  'DIEZ ',
  'ONCE ',
  'DOCE ',
  'TRECE ',
  'CATORCE ',
  'QUINCE ',
  'DIECISEIS ',
  'DIECISIETE ',
  'DIECIOCHO ',
  'DIECINUEVE ',
  'VEINTE ',
  'TREINTA ',
  'CUARENTA ',
  'CINCUENTA ',
  'SESENTA ',
  'SETENTA ',
  'OCHENTA ',
  'NOVENTA ',
];

function numeroALetras(num: number | null | undefined): string {
  if (num === null || num === undefined) return '';
  if (num === 0) return 'CERO';
  if (num === 100) return 'CIEN';

  let letras = '';
  const n = Math.floor(num);

  if (n >= 10 && n < 30) {
    letras = DECENAS[n - 10];
  } else if (n >= 30 && n < 100) {
    const decena = Math.floor(n / 10);
    const unidad = n % 10;
    letras = DECENAS[decena + 8];
    if (unidad > 0) letras += `Y ${UNIDADES[unidad]}`;
  } else {
    letras = UNIDADES[n];
  }

  return letras.trim();
}

// ==========================================
// 2. ESTILOS DEL PDF (Simulando la estructura oficial)
// ==========================================
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 8,
    fontFamily: 'Helvetica', // Fuente segura nativa de PDFs
    backgroundColor: '#ffffff',
  },
  // Cabecera Principal
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  logoPlaceholder: {
    width: 50,
    height: 50,
    border: '1pt solid #ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: { alignItems: 'center', flex: 1 },
  mainTitle: { fontSize: 14, fontWeight: 'bold', fontFamily: 'Helvetica-Bold' },
  subTitle: { fontSize: 10, marginTop: 3 },

  // Cuadros de Datos del Estudiante
  infoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    border: '1pt solid #000',
    padding: 5,
  },
  infoBlock: { flex: 1, paddingHorizontal: 5 },
  infoText: { fontSize: 7, marginBottom: 3 },
  infoBold: { fontFamily: 'Helvetica-Bold' },

  // Grilla (Tabla)
  table: {
    width: '100%',
    borderTop: '1pt solid #000',
    borderLeft: '1pt solid #000',
    marginTop: 10,
  },
  tableRow: { flexDirection: 'row' },

  // Columnas de la Tabla (Suman 100%)
  colCampo: {
    width: '18%',
    borderRight: '1pt solid #000',
    borderBottom: '1pt solid #000',
    padding: 3,
    justifyContent: 'center',
  },
  colArea: {
    width: '25%',
    borderRight: '1pt solid #000',
    borderBottom: '1pt solid #000',
    padding: 3,
    justifyContent: 'center',
  },
  colTrim: {
    width: '7%',
    borderRight: '1pt solid #000',
    borderBottom: '1pt solid #000',
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colPromedio: {
    width: '8%',
    borderRight: '1pt solid #000',
    borderBottom: '1pt solid #000',
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
  },
  colLiteral: {
    width: '28%',
    borderRight: '1pt solid #000',
    borderBottom: '1pt solid #000',
    padding: 3,
    justifyContent: 'center',
  },

  // Celdas de Encabezado
  headerCell: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 6,
    textAlign: 'center',
  },
  cellText: { fontSize: 6, textAlign: 'center' },
  cellTextLeft: { fontSize: 6, textAlign: 'left' },

  // Firmas
  signaturesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  signatureBox: { width: '25%', alignItems: 'center' },
  signatureLine: {
    borderTop: '1pt solid #000',
    width: '100%',
    marginBottom: 5,
  },
  signatureText: {
    fontSize: 6,
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
  },

  // Footer Legal
  footerText: { fontSize: 6, marginTop: 30, textAlign: 'left', color: '#555' },
});

// ==========================================
// 3. COMPONENTE REACT-PDF
// ==========================================
interface BolivianLibretaProps {
  data: any; // Aquí entra el JSON que estructuramos en el ReportsService
}

export const BolivianLibreta = ({ data }: BolivianLibretaProps) => {
  // Evita crash si los datos no han llegado aún
  if (!data || !data.student)
    return (
      <Document>
        <Page>
          <Text>Cargando...</Text>
        </Page>
      </Document>
    );

  const fullName =
    `${data.student.lastNamePaterno} ${data.student.lastNameMaterno || ''} ${data.student.names}`
      .trim()
      .toUpperCase();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* --- 1. CABECERA --- */}
        <View style={styles.header}>
          <View style={styles.logoPlaceholder}>
            <Text style={{ fontSize: 6 }}>ESCUDO BOLIVIA</Text>
          </View>
          <View style={styles.headerTitles}>
            <Text style={styles.mainTitle}>Libreta Escolar Electrónica</Text>
            <Text style={styles.subTitle}>
              Educación {data.classroom?.level || 'REGULAR'} Comunitaria
              Vocacional
            </Text>
          </View>
          <View style={styles.logoPlaceholder}>
            <Text style={{ fontSize: 6 }}>CÓDIGO QR</Text>
          </View>
        </View>

        {/* --- 2. DATOS DEL ESTUDIANTE Y UE --- */}
        <View style={styles.infoSection}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Código RUDE:</Text>{' '}
              {data.student.rudeCode || 'EN TRAMITE'}
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Apellidos y Nombres:</Text>{' '}
              {fullName}
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Año de Escolaridad:</Text>{' '}
              {data.classroom?.grade} "{data.classroom?.section}"
            </Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Unidad Educativa:</Text>{' '}
              {data.institution?.rueCode} - {data.institution?.name}
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Distrito Educativo:</Text>{' '}
              {data.institution?.district}
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Turno:</Text>{' '}
              {data.classroom?.shift}
            </Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Departamento:</Text>{' '}
              {data.institution?.department}
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Dependencia:</Text>{' '}
              {data.institution?.dependencyType}
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Gestión:</Text>{' '}
              {data.academicYear?.year}
            </Text>
          </View>
        </View>

        {/* --- 3. TABLA DE CALIFICACIONES --- */}
        <View style={styles.table}>
          {/* Fila Encabezado Nivel 1 */}
          <View style={styles.tableRow}>
            <View style={{ ...styles.colCampo, backgroundColor: '#f9f9f9' }}>
              <Text style={styles.headerCell}>
                Campos de Saberes y Conocimientos
              </Text>
            </View>
            <View style={{ ...styles.colArea, backgroundColor: '#f9f9f9' }}>
              <Text style={styles.headerCell}>Áreas Curriculares</Text>
            </View>
            <View
              style={{
                width: '21%',
                borderRight: '1pt solid #000',
                borderBottom: '1pt solid #000',
                padding: 0,
              }}
            >
              <View
                style={{
                  borderBottom: '1pt solid #000',
                  padding: 3,
                  backgroundColor: '#f9f9f9',
                }}
              >
                <Text style={styles.headerCell}>
                  Evaluación (Ser, Saber, Hacer, Decidir)
                </Text>
              </View>
              <View style={{ flexDirection: 'row', flex: 1 }}>
                <View
                  style={{
                    width: '33.3%',
                    borderRight: '1pt solid #000',
                    padding: 2,
                    justifyContent: 'center',
                  }}
                >
                  <Text style={styles.headerCell}>1er Trim</Text>
                </View>
                <View
                  style={{
                    width: '33.3%',
                    borderRight: '1pt solid #000',
                    padding: 2,
                    justifyContent: 'center',
                  }}
                >
                  <Text style={styles.headerCell}>2do Trim</Text>
                </View>
                <View
                  style={{
                    width: '33.4%',
                    padding: 2,
                    justifyContent: 'center',
                  }}
                >
                  <Text style={styles.headerCell}>3er Trim</Text>
                </View>
              </View>
            </View>
            <View style={{ ...styles.colPromedio, backgroundColor: '#f9f9f9' }}>
              <Text style={styles.headerCell}>Promedio Anual</Text>
            </View>
            <View style={{ ...styles.colLiteral, backgroundColor: '#f9f9f9' }}>
              <Text style={styles.headerCell}>
                Valoración Cuantitativa y Cualitativa
              </Text>
            </View>
          </View>

          {/* Filas de Materias pivoteadas */}
          {data.campos?.map((campo: any, indexCampo: number) => {
            return campo.asignaturas.map((asig: any, indexAsig: number) => (
              <View
                style={styles.tableRow}
                key={`${campo.areaName}-${asig.name}`}
              >
                {/* El nombre del Campo solo se muestra en la primera fila del grupo */}
                <View style={styles.colCampo}>
                  <Text style={styles.cellTextLeft}>
                    {indexAsig === 0 ? campo.areaName : ''}
                  </Text>
                </View>
                <View style={styles.colArea}>
                  <Text style={styles.cellTextLeft}>{asig.name}</Text>
                </View>
                <View style={styles.colTrim}>
                  <Text style={styles.cellText}>{asig.t1 || '-'}</Text>
                </View>
                <View style={styles.colTrim}>
                  <Text style={styles.cellText}>{asig.t2 || '-'}</Text>
                </View>
                <View style={styles.colTrim}>
                  <Text style={styles.cellText}>{asig.t3 || '-'}</Text>
                </View>

                <View style={styles.colPromedio}>
                  <Text
                    style={{ ...styles.cellText, fontFamily: 'Helvetica-Bold' }}
                  >
                    {asig.promedioAnual || '-'}
                  </Text>
                </View>
                <View style={styles.colLiteral}>
                  <Text style={styles.cellTextLeft}>
                    {asig.promedioAnual
                      ? numeroALetras(asig.promedioAnual)
                      : '-'}
                  </Text>
                </View>
              </View>
            ));
          })}
        </View>

        {/* --- 4. ZONA DE FIRMAS --- */}
        <View style={styles.signaturesContainer}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureText}>Sello Unidad Educativa</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureText}>Firma Director/a</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureText}>Firma Maestra/o</Text>
          </View>
        </View>

        <Text style={styles.footerText}>
          Informe de Promoción: LA O EL ESTUDIANTE HA SIDO PROMOVIDO(A) AL AÑO
          DE ESCOLARIDAD INMEDIATO SUPERIOR. (Generado electrónicamente)
        </Text>
      </Page>
    </Document>
  );
};
