"use client";
import { useState, useEffect } from "react";
import { message, Form } from "antd";

export const useCalendar = () => {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false); 
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [usersList, setUsersList] = useState([]);
  
  const [selectedStore, setSelectedStore] = useState(null);
  
  const [logs, setLogs] = useState([]);
  const [blacklist, setBlacklist] = useState([]);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isBlacklistModalOpen, setIsBlacklistModalOpen] = useState(false);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [isExternalForm, setIsExternalForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [isEventDetailsModalOpen, setIsEventDetailsModalOpen] = useState(false);
  const [selectedEventDetails, setSelectedEventDetails] = useState(null);
  
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [selectedEventToJoin, setSelectedEventToJoin] = useState(null);
  const [isUnsubscribeModalOpen, setIsUnsubscribeModalOpen] = useState(false);
  
  const [isAttendeesModalOpen, setIsAttendeesModalOpen] = useState(false);
  const [selectedEventIdForAttendees, setSelectedEventIdForAttendees] = useState(null);
  const [registrations, setRegistrations] = useState([]);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState(null);
  
  const [passwordForm] = Form.useForm();
  const [eventForm] = Form.useForm();
  const [joinForm] = Form.useForm();
  const [unsubscribeForm] = Form.useForm();
  const [authForm] = Form.useForm();
  const [blacklistForm] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    // 1. Session ellenőrzése a backendtől induláskor (Nem localStorage!)
    checkSession();
    
    // Bolt betöltése
    const storedStore = localStorage.getItem('tavern_selected_store');
    if (storedStore) setSelectedStore(storedStore);
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.user) {
        setUserName(data.user.username);
        setUserEmail(data.user.email);
        setUserRole(data.user.role);
        fetchAdminData(); // Ha admin, betölti a nagy adatot
      } else {
        fetchPublicData(); // Ha nem admin, csak a kicsit
      }
    } catch (e) {
      fetchPublicData(); // Ha hiba van (offline), próbálja a publikust
    }
  };

  const handleSelectStore = (storeId) => {
    setSelectedStore(storeId);
    if (storeId) {
      localStorage.setItem('tavern_selected_store', storeId);
    } else {
      localStorage.removeItem('tavern_selected_store');
    }
  };

  // Publikus adatok letöltése
  const fetchPublicData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/public-data?t=${Date.now()}`);
      const data = await response.json();
      if (data.tournaments) setTournaments(data.tournaments);
      if (typeof data.isMaintenance !== 'undefined') setIsMaintenance(data.isMaintenance);
    } catch (e) {}
    setLoading(false);
  };

  // Admin adatok letöltése
  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin-data?t=${Date.now()}`);
      if (response.status === 401) {
         // Ha a token lejárt, visszadob publikusra
         setUserRole(null);
         fetchPublicData();
         return;
      }
      const data = await response.json();
      if (data.tournaments) setTournaments(data.tournaments);
      if (data.registrations) setRegistrations(data.registrations);
      if (data.users) setUsersList(data.users);
      if (data.logs) setLogs(data.logs);
      if (data.blacklist) setBlacklist(data.blacklist);
      if (typeof data.isMaintenance !== 'undefined') setIsMaintenance(data.isMaintenance);
    } catch (e) {
       fetchPublicData(); // Fallback
    }
    setLoading(false);
  };

  const fetchData = () => {
    if (userRole === 'admin' || userRole === 'owner') {
      fetchAdminData();
    } else {
      fetchPublicData();
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/sync');
      const data = await response.json();
      if (data.error) messageApi.error(`Hiba: ${data.error}`);
      else { messageApi.success(data.message || "Szinkronizálás sikeres!"); fetchData(); }
    } catch (e) { messageApi.error("Hálózati hiba."); }
    setIsSyncing(false);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUserRole(null); setUserName(""); setUserEmail("");
    fetchPublicData();
  };

  const handleAuthSubmit = async (values) => {
    const action = isRegistering ? 'register' : 'login';
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...values }) });
      const data = await response.json();
      if (data.error) messageApi.error(data.error);
      else if (action === 'login') {
        messageApi.success(`Üdvözlünk, ${data.user.username}!`);
        setUserName(data.user.username); setUserEmail(data.user.email); setUserRole(data.user.role);
        setIsAuthModalOpen(false); authForm.resetFields();
        fetchAdminData(); // Login után azonnal lerántja a titkos adatokat!
      } else {
        messageApi.success('Sikeres regisztráció! Most jelentkezz be.');
        setIsRegistering(false);
        authForm.resetFields();
      }
    } catch (e) { messageApi.error("Szerver hiba történt."); }
  };

  const toggleMaintenance = async (newState) => {
    await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'TOGGLE_MAINTENANCE', payload: { isMaintenance: newState } }) });
    setIsMaintenance(newState); messageApi.success(newState ? "Karbantartás BEKAPCSOLVA." : "Karbantartás KIKAPCSOLVA."); fetchData();
  };

  const handleBanEmail = async (values) => {
    await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'BAN_EMAIL', payload: { email: values.email, reason: values.reason } }) });
    messageApi.success("E-mail cím feketelistára téve."); blacklistForm.resetFields(); fetchData();
  };

  const handleUnbanEmail = async (email) => {
    await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'UNBAN_EMAIL', payload: { email } }) });
    messageApi.success("Tiltás feloldva."); fetchData();
  };

  const handleExportDB = () => window.location.href = '/api/export-db';

  const handleCleanupOldEvents = async () => {
    try {
      const response = await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'CLEANUP_OLD_EVENTS', payload: {} }) });
      const result = await response.json();
      if (result.error) messageApi.error(result.error);
      else { messageApi.success(`${result.count} db régi esemény törölve!`); fetchData(); }
    } catch (e) { messageApi.error("Hálózati hiba történt."); }
  };

  const toggleUserRole = async (targetUser) => {
    const makeAdmin = targetUser.role !== 'admin';
    const targetId = String(targetUser._id || targetUser.id);
    await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'TOGGLE_ROLE', payload: { targetUserId: targetId, makeAdmin }}) });
    fetchData();
  };

  const initiatePasswordChange = (user) => { setSelectedUserForPassword(user); passwordForm.resetFields(); setIsPasswordModalOpen(true); };
  
  const submitPasswordChange = async (values) => {
    const uId = String(selectedUserForPassword._id || selectedUserForPassword.id);
    try {
      const response = await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'CHANGE_USER_PASSWORD', payload: { userId: uId, newPassword: values.newPassword } }) });
      const result = await response.json();
      if (result.error) { messageApi.error(result.error); return; }
      messageApi.success("Jelszó sikeresen felülírva!"); setIsPasswordModalOpen(false);
    } catch (e) { messageApi.error("Hálózati hiba történt."); }
  };

  const handleDeleteUser = async (userId) => {
    await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'DELETE_USER', payload: { userId: String(userId) } }) });
    messageApi.success("Felhasználó törölve."); fetchData();
  };

  // Képfeltöltés átirányítva a biztonságos backend szerverünkhöz!
  const handleImageUpload = async (info, targetForm) => {
    const file = info.file.originFileObj || info.file; if (!file) return;
    setIsUploading(true);
    const formData = new FormData(); formData.append('image', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) { targetForm.setFieldsValue({ imageUrl: data.url }); messageApi.success('Kép feltöltve!'); } 
      else { messageApi.error(`Hiba: ${data.error}`); }
    } catch (err) { messageApi.error('Hálózati hiba a feltöltésnél.'); }
    setIsUploading(false);
  };

  const saveEvent = async (values) => {
    const formValues = values || eventForm.getFieldsValue(); 
    try {
      const payload = { 
        ...formValues, 
        max_players: parseInt(formValues.max_players) || 16, 
        external_url: formValues.external_url || "", 
        imageUrl: formValues.imageUrl || "", 
        isExternalEvent: !!formValues.external_url
      };
      
      if (editingEventId) { 
        await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'EDIT_TOURNAMENT', payload: { id: editingEventId, ...payload } }) }); 
        messageApi.success("Frissítve!"); 
      } else { 
        await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'ADD_TOURNAMENT', payload }) }); 
        messageApi.success("Létrehozva!"); 
      }
      
      setIsEventModalOpen(false); eventForm.resetFields(); setEditingEventId(null); setIsExternalForm(false); fetchData();
    } catch (err) {}
  };

  const handleDeleteTournament = async (tournamentId) => { 
     await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'DELETE_TOURNAMENT', payload: { tournamentId: String(tournamentId), id: String(tournamentId) }}) }); 
     messageApi.success("Esemény törölve."); fetchData(); 
   };

  const initiateJoin = (tournament) => {
    setIsEventDetailsModalOpen(false);
    if (tournament.external_url) { window.open(tournament.external_url, '_blank'); return; }
    setSelectedEventToJoin(tournament); joinForm.setFieldsValue({ name: userName || "", email: userEmail || "" }); setIsJoinModalOpen(true);
  };

  const submitJoin = async (values) => {
    const eId = String(selectedEventToJoin._id || selectedEventToJoin.id);
    try {
      const response = await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'JOIN_TOURNAMENT', payload: { tournamentId: eId, ...values }}) });
      const result = await response.json();
      if (result.error) { messageApi.error(result.error); return; }
      messageApi.success(result.isQueue ? "Várólistára kerültél!" : "Hely biztosítva!");
      setIsJoinModalOpen(false); joinForm.resetFields(); fetchData();
    } catch (e) {}
  };

  const initiateUnsubscribe = (tournament) => {
    setIsEventDetailsModalOpen(false); setSelectedEventToJoin(tournament); unsubscribeForm.resetFields(); setIsUnsubscribeModalOpen(true);
  };

  const submitUnsubscribe = async (values) => {
    const eId = String(selectedEventToJoin._id || selectedEventToJoin.id);
    try {
      const response = await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'UNSUBSCRIBE_BY_EMAIL', payload: { tournamentId: eId, email: values.email } }) });
      const result = await response.json();
      if (result.error) { messageApi.error(result.error); return; }
      messageApi.success("Sikeresen lejelentkeztél az eseményről."); setIsUnsubscribeModalOpen(false); fetchData(); 
    } catch (e) { messageApi.error("Hálózati hiba történt."); }
  };

  const handleRemoveRegistration = async (registrationId) => {
    try {
      await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'REMOVE_REGISTRATION', payload: { registrationId } }) });
      messageApi.success("Jelentkező törölve."); fetchData(); 
    } catch (err) {}
  };

  const formatEventDate = (dateString) => {
    if (!dateString) return "Hamarosan"; 
    const d = new Date(dateString); if (isNaN(d.getTime())) return dateString; 
    return (d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' })).replace(/^\w/, c => c.toUpperCase());
  };

  return {
    tournaments, setTournaments, loading, userRole, userName, userEmail, usersList,
    selectedStore, handleSelectStore, 
    isMaintenance, toggleMaintenance, logs, isLogModalOpen, setIsLogModalOpen, blacklist, isBlacklistModalOpen, setIsBlacklistModalOpen, handleBanEmail, handleUnbanEmail, blacklistForm, handleExportDB, handleCleanupOldEvents,
    isSyncing, handleSync,
    isAuthModalOpen, setIsAuthModalOpen, isRegistering, setIsRegistering, authForm, handleAuthSubmit, handleLogout, toggleUserRole,
    isPasswordModalOpen, setIsPasswordModalOpen, selectedUserForPassword, passwordForm, initiatePasswordChange, submitPasswordChange, handleDeleteUser,
    isEventModalOpen, setIsEventModalOpen, isUsersModalOpen, setIsUsersModalOpen, isExternalForm, setIsExternalForm, editingEventId, setEditingEventId, eventForm, saveEvent, handleDeleteTournament,
    isUploading, handleImageUpload, isEventDetailsModalOpen, setIsEventDetailsModalOpen, selectedEventDetails, setSelectedEventDetails,
    isJoinModalOpen, setIsJoinModalOpen, selectedEventToJoin, joinForm, initiateJoin, submitJoin,
    isUnsubscribeModalOpen, setIsUnsubscribeModalOpen, unsubscribeForm, initiateUnsubscribe, submitUnsubscribe,
    isAttendeesModalOpen, setIsAttendeesModalOpen, selectedEventIdForAttendees, setSelectedEventIdForAttendees, registrations, handleRemoveRegistration,
    messageApi, contextHolder, formatEventDate, fetchData
  };
};