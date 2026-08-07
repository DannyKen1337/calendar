
export const S = {
  layout: { minHeight: '100vh', background: '#121212' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#2B1A1C', borderBottom: '2px solid #4A2E33', position: 'sticky', top: 0, zIndex: 10, padding: '0 clamp(15px, 3vw, 30px)', height: '70px', overflow: 'hidden' },
  logoContainer: { display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer' },
  logoText: { fontWeight: '900', fontSize: 'clamp(18px, 4vw, 24px)', color: '#E5B15D', letterSpacing: '3px', fontFamily: 'Georgia, serif', textTransform: 'uppercase' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '15px' },
  userName: { color: '#E5B15D' },
  content: { padding: 'clamp(20px, 5vw, 60px) clamp(10px, 3vw, 20px)', maxWidth: '1200px', margin: '0 auto', width: '100%' },

  sectionTitle: { color: '#E5B15D', marginTop: '20px', fontFamily: 'Georgia, serif', fontSize: 'clamp(1.5rem, 4vw, 2rem)' },
  titleIcon: { color: '#E5B15D', marginRight: '10px' },
  divider: { borderColor: '#4A2E33' },
  emptyText: { textAlign: 'center', color: '#9a8a8c' },

  eventItem: { padding: '15px 0' },
  eventCard: { width: '100%', border: '1px solid #4A2E33', borderRadius: '16px', background: '#2B1A1C' },
  eventFlex: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' },
  eventInfo: { display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' },
  eventImg: { width: '70px', height: '70px', objectFit: 'contain', padding: '5px', backgroundColor: '#0a0a0a', borderRadius: '12px', border: '1px solid #4A2E33' },
  eventDateBox: { background: '#121212', padding: '10px', borderRadius: '12px', textAlign: 'center', minWidth: '70px', border: '1px solid #4A2E33' },
  eventDateIcon: { fontSize: '20px', color: '#E5B15D' },
  eventDateText: { fontSize: '12px', fontWeight: 'bold', color: '#E0D6C8', marginTop: '5px' },
  eventTag: { marginBottom: '5px', borderRadius: '6px', background: '#4A2E33', color: '#E5B15D', border: 'none' },
  eventTitle: { margin: 0, color: '#E0D6C8' },
  extLinkText: { display: 'block', marginTop: '5px', color: '#baaaac' },
  linkIcon: { marginRight: '5px' },
  queueTag: { marginLeft: '10px', background: '#592424', color: '#ff7875', border: 'none' },

  calendarScroll: { overflowX: 'auto', paddingBottom: '15px' },
  calendarGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minWidth: '800px', gap: '8px' }, 
  calHeaderCell: { textAlign: 'center', fontWeight: 'bold', color: '#E5B15D', padding: '10px 0', borderBottom: '1px solid #4A2E33' },
  calDayCell: { background: '#2B1A1C', minHeight: '110px', borderRadius: '8px', padding: '8px', border: '1px solid #4A2E33', display: 'flex', flexDirection: 'column', gap: '5px' },
  calDayNum: { fontSize: '14px', fontWeight: 'bold', textAlign: 'right', marginBottom: '5px' },
  calEventStrip: { background: '#E5B15D', color: '#000', fontSize: '11px', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'transform 0.1s' },

  adminHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
  adminTitleMargin: { color: '#E5B15D', margin: 0, fontFamily: 'Georgia, serif' },
  tabHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' },
  tabTitle: { color: '#E5B15D', margin: 0, fontFamily: 'Georgia, serif' },
  
  formMargin: { marginTop: '20px' },
  modalHeaderBox: { background: '#2B1A1C', padding: '15px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #4A2E33' },
  switchBox: { background: '#2B1A1C', padding: '10px', borderRadius: '8px', border: '1px solid #4A2E33' },
  uploadFlex: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
  formActions: { textAlign: 'right', marginBottom: 0 },
  formActionsBasic: { textAlign: 'right' },

  primaryBtn: { background: '#E5B15D', borderColor: '#E5B15D', color: '#000', fontWeight: 'bold' },
  w100: { width: '100%' },
  centerText: { textAlign: 'center' },
  mr10: { marginRight: '10px' }
};
