import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const CARNET_SIZE = [153, 243];

const styles = StyleSheet.create({
    page: { backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column' },
    headerFront: { backgroundColor: '#000060', paddingVertical: 12, alignItems: 'center', borderBottom: '3pt solid #2563EB' },
    schoolTitle: { color: '#FFFFFF', fontSize: 8, fontWeight: 'extrabold', letterSpacing: 1.5 },
    nameBox: { paddingHorizontal: 10, marginTop: 20, alignItems: 'center' },
    shortName: { fontSize: 10, fontWeight: 'extrabold', color: '#0F172A', textAlign: 'center', textTransform: 'uppercase', lineHeight: 1.2 },
    courseBox: { backgroundColor: '#F8FAFC', borderTop: '1pt solid #E2E8F0', borderBottom: '1pt solid #E2E8F0', paddingVertical: 5, marginTop: 10, width: '100%', alignItems: 'center' },
    courseText: { fontSize: 7.5, fontWeight: 'extrabold', color: '#2563EB', textTransform: 'uppercase', letterSpacing: 0.5 },
    qrContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    qrImage: { width: 85, height: 85 },
    footerBar: { backgroundColor: '#000060', height: 8, width: '100%' },
    // Reverso
    backHeader: { backgroundColor: '#F1F5F9', paddingVertical: 8, alignItems: 'center', borderBottom: '1pt solid #E2E8F0' },
    backTitle: { fontSize: 6, fontWeight: 'extrabold', color: '#64748B', letterSpacing: 1 },
    detailsBox: { padding: 10, flex: 1 },
    detailLabel: { fontSize: 4.5, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 1 },
    detailValue: { fontSize: 6.5, fontWeight: 'extrabold', color: '#0F172A', marginBottom: 5, textTransform: 'uppercase' },
    divider: { borderBottom: '1pt solid #E2E8F0', marginVertical: 4 },
    rulesText: { fontSize: 4.5, color: '#64748B', textAlign: 'justify', lineHeight: 1.5, marginTop: 2 },
    signatureBox: { alignItems: 'center', marginTop: 'auto', marginBottom: 8 },
    signatureLine: { width: 70, borderBottom: '1pt solid #94A3B8', marginBottom: 3 },
    signatureLabel: { fontSize: 5, color: '#64748B', fontWeight: 'bold' },
    backFooter: { backgroundColor: '#000060', paddingVertical: 6, alignItems: 'center' },
    backFooterText: { fontSize: 5, color: '#FFFFFF', letterSpacing: 0.5, fontWeight: 'bold' }
});

export const CarnetTemplate = ({ student, enrollment, qrBase64 }: any) => {
    const firstName = student?.names?.split(' ')[0] || '';
    const firstLastName = student?.lastNamePaterno || '';
    const shortName = `${firstName} ${firstLastName}`;
    const fullName = `${student?.names} ${student?.lastNamePaterno} ${student?.lastNameMaterno || ''}`.trim();

    return (
        <Document>
            <Page size={CARNET_SIZE as any} style={styles.page}>
                <View style={styles.headerFront}><Text style={styles.schoolTitle}>U.E. CHE GUEVARA</Text></View>
                <View style={styles.nameBox}><Text style={styles.shortName}>{shortName}</Text></View>
                <View style={styles.courseBox}><Text style={styles.courseText}>{enrollment?.classroom?.grade} "{enrollment?.classroom?.section}"</Text></View>
                <View style={styles.qrContainer}>{qrBase64 ? <Image src={qrBase64} style={styles.qrImage} /> : null}</View>
                <View style={styles.footerBar} />
            </Page>
            <Page size={CARNET_SIZE as any} style={styles.page}>
                <View style={styles.backHeader}><Text style={styles.backTitle}>IDENTIFICACIÓN INSTITUCIONAL</Text></View>
                <View style={styles.detailsBox}>
                    <Text style={styles.detailLabel}>Estudiante</Text><Text style={styles.detailValue}>{fullName}</Text>
                    <Text style={styles.detailLabel}>C.I.</Text><Text style={styles.detailValue}>{student?.ci || 'S/N'}</Text>
                    <Text style={styles.detailLabel}>RUDE</Text><Text style={styles.detailValue}>{student?.rudeCode || 'EN TRÁMITE'}</Text>
                    <View style={styles.divider} />
                    <Text style={styles.rulesText}>Este documento es personal e intransferible. En caso de extravío, favor comunicarse con secretaría.</Text>
                    <View style={styles.signatureBox}><View style={styles.signatureLine} /><Text style={styles.signatureLabel}>Dirección</Text></View>
                </View>
                <View style={styles.backFooter}><Text style={styles.backFooterText}>SUCRE - BOLIVIA | GESTIÓN {enrollment?.academicYear?.year}</Text></View>
            </Page>
        </Document>
    );
};