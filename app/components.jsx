export const AdminEvents = ({ app: v }) => {
  const currentAttendees = (v.registrations || []).filter(reg => String(reg.tournamentId) === String(v.selectedEventIdForAttendees));
  
  return (
    <ConfigProvider theme={tavernTheme}>
      <div>
        <div style={S.tabHeader}>
          <Title level={3} style={S.tabTitle}>Naptár Kezelése</Title>
          <Space style={{ flexWrap: 'wrap' }}>
            <Button 
               type="default" 
               shape="round" 
               style={{ color: '#E5B15D', borderColor: '#E5B15D' }} 
               icon={<SyncOutlined spin={v.isSyncing} />} 
               onClick={v.handleSync}
               loading={v.isSyncing}
            >
              UVS Szinkron
            </Button>
            <Button type="default" shape="round" icon={<SafetyCertificateOutlined />} onClick={() => v.setIsUsersModalOpen(true)}>Szervezők</Button>
            <Button type="primary" shape="round" icon={<PlusOutlined />} style={{ color: '#000', fontWeight: 'bold' }} onClick={() => { v.eventForm.resetFields(); v.setEditingEventId(null); v.setIsExternalForm(false); v.setIsEventModalOpen(true); }}>Új Esemény</Button>
          </Space>
        </div>
        
        <EventList tournamentsData={v.tournaments} isAdmin={true} app={v} />
        
        <Modal 
          title={<span style={{ fontFamily: 'Georgia, serif', fontSize: '1.2rem' }}>{v.editingEventId ? "Esemény szerkesztése" : "Új Esemény Létrehozása"}</span>}
          open={v.isEventModalOpen} 
          onCancel={() => v.setIsEventModalOpen(false)} 
          onOk={() => v.eventForm.submit()} 
          closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}
          okText="Mentés" 
          cancelText="Mégse"
          okButtonProps={{ style: { color: '#000', fontWeight: 'bold' } }}
        >
          <Form form={v.eventForm} layout="vertical" onFinish={v.saveEvent} className="mt-4">
            <Form.Item name="name" label="Esemény neve" rules={[{ required: true, message: 'Kötelező!' }]}>
              <Input placeholder="Pl.: Nexus Night BO1" />
            </Form.Item>
            <Form.Item name="category" label="Kategória (Játék)" rules={[{ required: true, message: 'Kötelező!' }]}>
              <Select placeholder="Válassz játékot...">
                {Object.keys(GAME_CONFIG).map(game => (
                  <Select.Option key={game} value={game}>{game}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="date" label="Dátum és Időpont" rules={[{ required: true, message: 'Kötelező!' }]}>
              <Input type="datetime-local" />
            </Form.Item>
            <Form.Item name="max_players" label="Max Létszám">
              <Input type="number" placeholder="Alapértelmezett: 16" />
            </Form.Item>
            <Form.Item name="external_url" label="Külső jelentkezési link (Opcionális)">
              <Input placeholder="https://..." />
            </Form.Item>
            <Form.Item name="description" label="Leírás (Opcionális)">
              <Input.TextArea rows={4} placeholder="További részletek a versenyről..." />
            </Form.Item>
          </Form>
        </Modal>

        <Modal title="Szervezős Felhasználók" open={v.isUsersModalOpen} onCancel={() => v.setIsUsersModalOpen(false)} footer={null} width={800} closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}>
          <Table dataSource={v.usersList || []} rowKey={(record) => record._id || record.id} pagination={{ pageSize: 5 }} columns={[
            { title: 'Felhasználónév', dataIndex: 'username', render: (text) => <Text strong style={{ color: '#E0D6C8' }}>{text}</Text> },
            { title: 'E-mail', dataIndex: 'email', render: (text) => <span style={{ color: '#baaaac' }}>{text}</span> },
            { title: 'Szerepkör', dataIndex: 'role', render: (role) => {
                if (role === 'owner') return <Tag color="purple">Tulajdonos</Tag>;
                if (role === 'admin') return <Tag color="orange">Admin</Tag>;
                return <Tag color="green">Játékos</Tag>;
            }},
            { title: 'Művelet', render: (_, record) => {
                // A saját magad és a másik tulajdonos fiókját ne lehessen a táblázatból birizgálni
                if (record.email === v.userEmail || record.role === 'owner') return <Text type="secondary">Védett fiók</Text>;
                
                return (
                  <Space style={{ flexWrap: 'wrap' }}>
                    <Button 
                      type={record.role === 'admin' ? 'default' : 'primary'} 
                      style={record.role === 'admin' ? {} : {color: '#000', fontWeight: 'bold'}} 
                      size="small" 
                      onClick={() => v.toggleUserRole(record)}
                    >
                      {record.role === 'admin' ? 'Visszafokozás' : 'Admin jog'}
                    </Button>

                    {/* EZT CSAK A TULAJDONOS FOGJA LÁTNI */}
                    {v.userRole === 'owner' && (
                      <>
                        <Button size="small" onClick={() => v.initiatePasswordChange(record)}>Új Jelszó</Button>
                        <Popconfirm title="Biztosan törlöd a felhasználót?" onConfirm={() => v.handleDeleteUser(record._id || record.id)} okText="Igen" cancelText="Mégse">
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </>
                    )}
                  </Space>
                )
            }}
          ]} />
        </Modal>

        {/* ÚJ TULAJDONOSI ABLAK: JELSZÓ VÁLTOZTATÁSA */}
        <Modal
          title={<span style={{ color: '#E5B15D', fontFamily: 'Georgia, serif' }}>Jelszó módosítása: {v.selectedUserForPassword?.username}</span>}
          open={v.isPasswordModalOpen}
          onCancel={() => v.setIsPasswordModalOpen(false)}
          onOk={() => v.passwordForm.submit()}
          okText="Mentés"
          cancelText="Mégse"
          okButtonProps={{ style: { color: '#000', fontWeight: 'bold' } }}
          closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}
        >
          <Form form={v.passwordForm} layout="vertical" onFinish={v.submitPasswordChange} className="mt-4">
            <Form.Item name="newPassword" label="Új jelszó" rules={[{ required: true, message: 'Kötelező megadni!', min: 6 }]}>
              <Input.Password placeholder="Új jelszó beírása..." />
            </Form.Item>
          </Form>
        </Modal>

        <Modal title="Jelentkezők kezelése" open={v.isAttendeesModalOpen} onCancel={() => v.setIsAttendeesModalOpen(false)} footer={null} width={750} closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}>
          <Table dataSource={currentAttendees} rowKey={(record) => record._id || record.id} pagination={false} columns={[
            { title: 'Név', dataIndex: 'name', key: 'name', render: text => <span style={{color: '#E0D6C8'}}>{text}</span> }, 
            { title: 'Email', dataIndex: 'email', key: 'email', render: text => <span style={{color: '#baaaac'}}>{text}</span> }, 
            { title: 'Státusz', dataIndex: 'status', key: 'status', render: (s) => <Tag color={s === 'Aktív' || s === 'Active' ? 'green' : 'warning'}>{s}</Tag> }, 
            { title: 'Művelet', key: 'action', render: (_, record) => (<Popconfirm title="Törlöd?" onConfirm={() => v.handleRemoveRegistration(record._id || record.id)} okText="Igen" cancelText="Mégse"><Button type="link" danger icon={<DeleteOutlined />}>Törlés</Button></Popconfirm>) }
          ]} />
        </Modal>
      </div>
    </ConfigProvider>
  );
};