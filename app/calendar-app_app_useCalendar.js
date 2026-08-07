
"use client";
import { useState, useEffect } from "react";
import { message, Form } from "antd";

const IMGBB_API_KEY = "IDE_JON_AZ_IMGBB_KULCSOD"; 

export const useCalendar = () => {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Admin state
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [view, setView] = useState("calendar"); // 'calendar' vagy 'admin'

  // Event modal state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isExternalForm, setIsExternalForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Event interaction state
  const [isEventDetailsModalOpen, setIsEventDetailsModalOpen] = useState(false);
  const [selectedEventDetails, setSelectedEventDetails] = useState(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [selectedEventToJoin, setSelectedEventToJoin] = useState(null);

  // Attendees state
  const [isAttendeesModalOpen, setIsAttendeesModalOpen] = useState(false);
  const [selectedEventAttendees, setSelectedEventAttendees] = useState([]);
  const [registrations, setRegistrations] = useState([]);

  const [eventForm] = Form.useForm();
  const [joinForm] = Form.useForm();
  const [authForm] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    const storedSession = localStorage.getItem('tavern_calendar_session');
    if (storedSession) {
      try { 
        const userData = JSON.parse(storedSession); 
        setUserName(userData.username); 
        setUserEmail(userData.email); 
        setUserRole(userData.role); 
      } catch (error) { 
        localStorage.removeItem('tavern_calendar_session'); 
      }
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/data?t=${Date.now()}`);
      const data = await response.json();
      if (data.tournaments) setTournaments(data.tournaments);
      if (data.registrations) setRegistrations(data.registrations);
    } catch (e) {
        console.error("Error fetching data:", e);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('tavern_calendar_session');
    setUserRole(null); setUserName(""); setUserEmail(""); setView("calendar");
    messageApi.info("Kijelentkezve.");
  };

  const handleAuthSubmit = async (values) => {
    const action = isRegistering ? 'register' : 'login';
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...values }) });
      const data = await response.json();
      if (data.error) messageApi.error(data.error);
      else {
        messageApi.success(`Üdvözlünk, ${data.user.username}!`);
        localStorage.setItem('tavern_calendar_session', JSON.stringify({ username: data.user.username, email: data.user.email, role: data.user.role }));
        setUserName(data.user.username); setUserEmail(data.user.email); setUserRole(data.user.role);
        setIsAuthModalOpen(false); authForm.resetFields();
      }
    } catch (e) { messageApi.error("Hiba a bejelentkezésnél."); }
  };

  const handleImageUpload = async (info, targetForm) => {
    if (IMGBB_API_KEY === "IDE_JON_AZ_IMGBB_KULCSOD") { messageApi.error("ImgBB API kulcs hiányzik!"); return; }
    const file = info.file.originFileObj || info.file; if (!file) return;
    setIsUploading(true);
    const formData = new FormData(); formData.append('image', file);
    try {
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) { targetForm.setFieldsValue({ imageUrl: data.data.url }); messageApi.success('Kép feltöltve!'); } 
      else { messageApi.error('Hiba a feltöltésnél.'); }
    } catch (err) { messageApi.error('Hálózati hiba a képfeltöltésnél.'); }
    setIsUploading(false);
  };

  const saveEvent = async () => {
    const values = eventForm.getFieldsValue();
    try {
      const payload = { name: values.name, category: values.category || "Egyéb", date: values.date, max_players: isExternalForm ? 0 : (values.max_players || 8), external_url: isExternalForm ? (values.external_url || "") : "", imageUrl: values.imageUrl || "", description: values.description || "", isExternalEvent: isExternalForm, userRole: userName };
      if (editingEventId) { await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'EDIT_TOURNAMENT', payload: { id: editingEventId, ...payload } }) }); messageApi.success("Esemény frissítve!"); } 
      else { await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'ADD_TOURNAMENT', payload }) }); messageApi.success("Esemény létrehozva!"); }
      setIsEventModalOpen(false); eventForm.resetFields(); setEditingEventId(null); setIsExternalForm(false); fetchData();
    } catch (err) {}
  };

  const handleDeleteTournament = async (tournamentId) => { 
    const safeId = String(tournamentId);
    await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'DELETE_TOURNAMENT', payload: { tournamentId: safeId, id: safeId }}) }); 
    messageApi.success("Esemény törölve."); 
    fetchData(); 
  };

  const initiateJoin = (tournament) => {
    setIsEventDetailsModalOpen(false);
    if (tournament.external_url) { window.open(tournament.external_url, '_blank'); return; }
    setSelectedEventToJoin(tournament); 
    joinForm.setFieldsValue({ name: userName || "", email: userEmail || "" }); 
    setIsJoinModalOpen(true);
  };

  const submitJoin = async (values) => {
    const eId = String(selectedEventToJoin._id || selectedEventToJoin.id);
    try {
      const response = await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'JOIN_TOURNAMENT', payload: { tournamentId: eId, ...values }}) });
      const result = await response.json();
      if (result.error) { messageApi.error(result.error); return; }
      const successMsg = result.isQueue ? "Várólistára kerültél!" : "Hely biztosítva!";
      messageApi.success(successMsg);
      setIsJoinModalOpen(false); joinForm.resetFields(); fetchData();
    } catch (e) {}
  };

  const handleRemoveRegistration = async (registrationId) => {
    try {
      const response = await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'REMOVE_REGISTRATION', payload: { registrationId } }) });
      const result = await response.json();
      if (result.success) { messageApi.success("Jelentkezés törölve."); fetchData(); } 
    } catch (err) {}
  };

  const formatEventDate = (dateString) => {
    if (!dateString) return "Hamarosan";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString; 
    const options = { month: 'short', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' };
    const formatted = d.toLocaleDateString('hu-HU', options);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  return {
    tournaments, setTournaments, loading, userRole, userName, userEmail, view, setView,
    isAuthModalOpen, setIsAuthModalOpen, isRegistering, setIsRegistering, authForm, handleAuthSubmit, handleLogout,
    isEventModalOpen, setIsEventModalOpen, isExternalForm, setIsExternalForm, editingEventId, setEditingEventId, eventForm, saveEvent, handleDeleteTournament,
    isUploading, handleImageUpload,
    isEventDetailsModalOpen, setIsEventDetailsModalOpen, selectedEventDetails, setSelectedEventDetails,
    isJoinModalOpen, setIsJoinModalOpen, selectedEventToJoin, joinForm, initiateJoin, submitJoin,
    isAttendeesModalOpen, setIsAttendeesModalOpen, selectedEventAttendees, setSelectedEventAttendees, registrations, handleRemoveRegistration,
    messageApi, contextHolder, formatEventDate, fetchData
  };
};
