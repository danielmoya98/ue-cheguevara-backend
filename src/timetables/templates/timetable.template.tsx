import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Helvetica', backgroundColor: '#FFFFFF' },
  header: { textAlign: 'center', marginBottom: 20 },
  title: {
    fontSize: 20,
    fontWeight: 'extrabold',
    color: '#000060',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  info: { fontSize: 10, color: '#666666' },

  // Estilos de la tabla (Grid)
  table: {
    width: '100%',
    border: '1pt solid #cbd5e1',
    display: 'flex',
    flexDirection: 'column',
  },
  tableRow: {
    display: 'flex',
    flexDirection: 'row',
    borderBottom: '1pt solid #cbd5e1',
  },
  tableColHeader: {
    width: '16.66%',
    padding: 6,
    backgroundColor: '#1e3a8a',
    borderRight: '1pt solid #cbd5e1',
    textAlign: 'center',
  },
  headerText: { color: 'white', fontSize: 10, fontWeight: 'bold' },

  // Celdas
  timeCol: {
    width: '16.66%',
    padding: 6,
    backgroundColor: '#f8fafc',
    borderRight: '1pt solid #cbd5e1',
    textAlign: 'center',
  },
  slotCol: {
    width: '16.66%',
    padding: 4,
    borderRight: '1pt solid #cbd5e1',
    textAlign: 'center',
    backgroundColor: '#ffffff',
  },

  // Recreo
  breakTimeCol: {
    width: '16.66%',
    padding: 6,
    backgroundColor: '#e2e8f0',
    borderRight: '1pt solid #cbd5e1',
    textAlign: 'center',
  },
  breakRow: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 8,
    textAlign: 'center',
    justifyContent: 'center',
  },
  breakText: {
    color: '#94a3b8',
    fontWeight: 'extrabold',
    fontSize: 12,
    letterSpacing: 4,
  },

  // Textos internos
  periodName: { fontSize: 10, fontWeight: 'bold', color: '#111827' },
  periodTime: { fontSize: 8, color: '#64748b', marginTop: 2 },
  subjectName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  teacherName: { fontSize: 8, color: '#475569' },
  spaceName: { fontSize: 7, color: '#2563eb', marginTop: 2 },
});

export const TimetableTemplate = ({ classroom, periods, slots }: any) => {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>
            UNIDAD EDUCATIVA "ERNESTO CHE GUEVARA"
          </Text>
          <Text style={styles.subtitle}>
            HORARIO ESCOLAR - {classroom.grade} "{classroom.section}" (
            {classroom.level})
          </Text>
          <Text style={styles.info}>
            Turno: {classroom.shift} | Gestión: {classroom.academicYear.year}
          </Text>
        </View>

        <View style={styles.table}>
          {/* Fila de Cabeceras */}
          <View style={styles.tableRow}>
            {[
              'PERIODO',
              'LUNES',
              'MARTES',
              'MIÉRCOLES',
              'JUEVES',
              'VIERNES',
            ].map((day) => (
              <View key={day} style={styles.tableColHeader}>
                <Text style={styles.headerText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Filas de Periodos */}
          {periods.map((p: any) => (
            <View key={p.id} style={styles.tableRow}>
              {/* Celda de la Hora */}
              <View style={p.isBreak ? styles.breakTimeCol : styles.timeCol}>
                <Text style={styles.periodName}>{p.name}</Text>
                <Text style={styles.periodTime}>
                  {p.startTime} - {p.endTime}
                </Text>
              </View>

              {/* Si es recreo, mostramos una celda gigante fusionada */}
              {p.isBreak ? (
                <View style={styles.breakRow}>
                  <Text style={styles.breakText}>R E C R E O</Text>
                </View>
              ) : (
                /* Si no es recreo, mapeamos los 5 días */
                [1, 2, 3, 4, 5].map((day) => {
                  const slot = slots.find(
                    (s: any) => s.dayOfWeek === day && s.classPeriodId === p.id,
                  );
                  return (
                    <View key={day} style={styles.slotCol}>
                      {slot ? (
                        <>
                          <Text style={styles.subjectName}>
                            {slot.teacherAssignment.subject.name}
                          </Text>
                          <Text style={styles.teacherName}>
                            Prof.{' '}
                            {slot.teacherAssignment.teacher.fullName
                              .split(' ')
                              .slice(0, 2)
                              .join(' ')}
                          </Text>
                          {slot.physicalSpace && (
                            <Text style={styles.spaceName}>
                              📍 {slot.physicalSpace.name}
                            </Text>
                          )}
                        </>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
};
