import { useMemo, useState } from 'react'
import {
  useEmployees, createBlankEmployee,
  DEPARTMENTS, CITIES, DESIGNATIONS, SKILLS_LIST, EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES,
  GENDERS, BLOOD_GROUPS, MARITAL_STATUSES, COUNTRIES, STATES, DOCUMENT_TYPES,
} from './Employees.jsx'

/* =========================================================================
   EmployeeForm — used for both CREATE and EDIT.
   Renders as a modal with tabbed sections. Validation covers only the
   fields called out as required in the spec; everything else is optional.
   ========================================================================== */

const TABS = [
  { key: 'personal', label: 'Personal' },
  { key: 'employment', label: 'Employment' },
  { key: 'address', label: 'Address' },
  { key: 'identification', label: 'Identification' },
  { key: 'skills', label: 'Skills' },
  { key: 'education', label: 'Education' },
  { key: 'experience', label: 'Experience' },
  { key: 'bank', label: 'Bank Details' },
  { key: 'documents', label: 'Documents' },
]

let uidCounter = 0
function uid(prefix) {
  uidCounter += 1
  return `${prefix}${Date.now().toString(36)}${uidCounter}`
}

function Field({ label, required, error, children, hint }) {
  return (
    <label className="ef-field">
      <span className="ef-field-label">
        {label}{required && <span className="ef-required">*</span>}
      </span>
      {children}
      {hint && !error && <span className="ef-hint">{hint}</span>}
      {error && <span className="ef-error">{error}</span>}
    </label>
  )
}

export default function EmployeeForm({ employeeId, onClose, onSaved }) {
  const { employees, addEmployee, updateEmployee, nextSuggestedId } = useEmployees()
  const isEdit = Boolean(employeeId)
  const existing = useMemo(() => employees.find((e) => e.id === employeeId), [employees, employeeId])

  const [data, setData] = useState(() =>
    isEdit && existing ? JSON.parse(JSON.stringify(existing)) : createBlankEmployee(nextSuggestedId)
  )
  const [activeTab, setActiveTab] = useState('personal')
  const [errors, setErrors] = useState({})
  const [skillInput, setSkillInput] = useState('')

  function set(field, value) {
    setData((prev) => ({ ...prev, [field]: value }))
  }

  function setBank(field, value) {
    setData((prev) => ({ ...prev, bankDetails: { ...prev.bankDetails, [field]: value } }))
  }

  function validate() {
    const required = {
      personal: ['id', 'firstName', 'gender', 'mobile'],
      employment: ['employeeCode', 'joiningDate', 'department', 'designation', 'branch', 'employmentType', 'employmentStatus'],
      address: ['country', 'state', 'city'],
    }
    const nextErrors = {}
    Object.entries(required).forEach(([, fields]) => {
      fields.forEach((f) => {
        if (!String(data[f] || '').trim()) nextErrors[f] = 'This field is required.'
      })
    })

    if (!isEdit && data.id && employees.some((e) => e.id === data.id)) {
      nextErrors.id = 'This Employee ID already exists.'
    }
    if (data.mobile && !/^[+\d][\d\s-]{6,}$/.test(data.mobile.trim())) {
      nextErrors.mobile = 'Enter a valid mobile number.'
    }
    if (data.email && !/^\S+@\S+\.\S+$/.test(data.email.trim())) {
      nextErrors.email = 'Enter a valid email address.'
    }

    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      const firstTab = Object.entries(required).find(([, fields]) => fields.some((f) => nextErrors[f]))
      if (firstTab) setActiveTab(firstTab[0])
      else if (nextErrors.email) setActiveTab('personal')
      return false
    }
    return true
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return

    if (isEdit) {
      const historyEntries = []
      ;['department', 'designation', 'branch', 'city', 'employmentStatus'].forEach((field) => {
        if (existing && existing[field] !== data[field]) {
          historyEntries.push({
            id: uid('h'),
            date: new Date().toISOString().slice(0, 10),
            changeType: field === 'employmentStatus' ? 'Employment Status' : field.charAt(0).toUpperCase() + field.slice(1),
            previousValue: existing[field] || '—',
            newValue: data[field] || '—',
          })
        }
      })
      updateEmployee(existing.id, data, historyEntries)
      onSaved('edit')
    } else {
      addEmployee(data)
      onSaved('create')
    }
  }

  function addSkill(skill) {
    const value = skill.trim()
    if (!value || data.skills.includes(value)) return
    set('skills', [...data.skills, value])
    setSkillInput('')
  }

  function removeSkill(skill) {
    set('skills', data.skills.filter((s) => s !== skill))
  }

  function addEducation() {
    set('education', [...data.education, { id: uid('ed'), degree: '', institution: '', specialization: '', startYear: '', endYear: '', grade: '' }])
  }
  function updateEducation(id, field, value) {
    set('education', data.education.map((row) => (row.id === id ? { ...row, [field]: value } : row)))
  }
  function removeEducation(id) {
    set('education', data.education.filter((row) => row.id !== id))
  }

  function addExperience() {
    set('experience', [...data.experience, { id: uid('ex'), company: '', designation: '', startDate: '', endDate: '', years: '', responsibilities: '' }])
  }
  function updateExperience(id, field, value) {
    set('experience', data.experience.map((row) => (row.id === id ? { ...row, [field]: value } : row)))
  }
  function removeExperience(id) {
    set('experience', data.experience.filter((row) => row.id !== id))
  }

  function addDocument() {
    set('documents', [...data.documents, { id: uid('doc'), type: DOCUMENT_TYPES[0], number: '', issueDate: '', expiryDate: '', fileName: '' }])
  }
  function updateDocument(id, field, value) {
    set('documents', data.documents.map((row) => (row.id === id ? { ...row, [field]: value } : row)))
  }
  function removeDocument(id) {
    set('documents', data.documents.filter((row) => row.id !== id))
  }
  function simulateUpload(id) {
    const fakeNames = ['scan_001.pdf', 'certificate.pdf', 'document_signed.pdf', 'upload.jpg']
    updateDocument(id, 'fileName', fakeNames[Math.floor(Math.random() * fakeNames.length)])
  }

  return (
    <div className="emp-modal-overlay" onClick={onClose}>
      <div className="emp-modal emp-modal-form" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="emp-modal-form-head">
          <h2>{isEdit ? 'Edit Employee' : 'New Employee'}</h2>
          <button className="emp-icon-btn" type="button" aria-label="Close form" onClick={onClose}>×</button>
        </div>

        <div className="ef-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              className={`ef-tab${activeTab === tab.key ? ' is-active' : ''}`}
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form className="ef-form" onSubmit={handleSubmit}>
          <div className="ef-body">

            {activeTab === 'personal' && (
              <div className="ef-grid">
                <Field label="Employee ID" required error={errors.id} hint={isEdit ? 'Read-only after creation.' : undefined}>
                  <input
                    type="text"
                    value={data.id}
                    disabled={isEdit}
                    onChange={(e) => set('id', e.target.value)}
                    placeholder="EMP014"
                  />
                </Field>
                <Field label="Employee Code" required error={errors.employeeCode}>
                  <input type="text" value={data.employeeCode} onChange={(e) => set('employeeCode', e.target.value)} placeholder="TRX-014" />
                </Field>
                <Field label="First Name" required error={errors.firstName}>
                  <input type="text" value={data.firstName} onChange={(e) => set('firstName', e.target.value)} />
                </Field>
                <Field label="Last Name">
                  <input type="text" value={data.lastName} onChange={(e) => set('lastName', e.target.value)} />
                </Field>
                <Field label="Gender" required error={errors.gender}>
                  <select value={data.gender} onChange={(e) => set('gender', e.target.value)}>
                    <option value="">Select gender</option>
                    {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label="Date of Birth">
                  <input type="date" value={data.dob} onChange={(e) => set('dob', e.target.value)} />
                </Field>
                <Field label="Blood Group">
                  <select value={data.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)}>
                    <option value="">Select</option>
                    {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label="Marital Status">
                  <select value={data.maritalStatus} onChange={(e) => set('maritalStatus', e.target.value)}>
                    <option value="">Select</option>
                    {MARITAL_STATUSES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label="Mobile Number" required error={errors.mobile}>
                  <input type="tel" value={data.mobile} onChange={(e) => set('mobile', e.target.value)} placeholder="+91 90000 00000" />
                </Field>
                <Field label="Email" error={errors.email}>
                  <input type="email" value={data.email} onChange={(e) => set('email', e.target.value)} />
                </Field>
                <Field label="Emergency Contact Name">
                  <input type="text" value={data.emergencyContactName} onChange={(e) => set('emergencyContactName', e.target.value)} />
                </Field>
                <Field label="Emergency Contact Number">
                  <input type="tel" value={data.emergencyContactNumber} onChange={(e) => set('emergencyContactNumber', e.target.value)} />
                </Field>
              </div>
            )}

            {activeTab === 'employment' && (
              <div className="ef-grid">
                <Field label="Employee Code" required error={errors.employeeCode}>
                  <input type="text" value={data.employeeCode} onChange={(e) => set('employeeCode', e.target.value)} />
                </Field>
                <Field label="Date of Joining" required error={errors.joiningDate}>
                  <input type="date" value={data.joiningDate} onChange={(e) => set('joiningDate', e.target.value)} />
                </Field>
                <Field label="Department" required error={errors.department}>
                  <select value={data.department} onChange={(e) => set('department', e.target.value)}>
                    <option value="">Select department</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Designation" required error={errors.designation}>
                  <select value={data.designation} onChange={(e) => set('designation', e.target.value)}>
                    <option value="">Select designation</option>
                    {DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Branch / Location" required error={errors.branch}>
                  <input type="text" value={data.branch} onChange={(e) => set('branch', e.target.value)} placeholder="e.g. Trichy Plant" />
                </Field>
                <Field label="Employment Type" required error={errors.employmentType}>
                  <select value={data.employmentType} onChange={(e) => set('employmentType', e.target.value)}>
                    <option value="">Select type</option>
                    {EMPLOYMENT_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Employment Status" required error={errors.employmentStatus}>
                  <select value={data.employmentStatus} onChange={(e) => set('employmentStatus', e.target.value)}>
                    {EMPLOYMENT_STATUSES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Reporting Manager">
                  <input type="text" value={data.reportingManager} onChange={(e) => set('reportingManager', e.target.value)} />
                </Field>
                <Field label="Work Location">
                  <input type="text" value={data.workLocation} onChange={(e) => set('workLocation', e.target.value)} />
                </Field>
              </div>
            )}

            {activeTab === 'address' && (
              <div className="ef-grid">
                <Field label="Address Line 1">
                  <input type="text" value={data.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} />
                </Field>
                <Field label="Address Line 2">
                  <input type="text" value={data.addressLine2} onChange={(e) => set('addressLine2', e.target.value)} />
                </Field>
                <Field label="Country" required error={errors.country}>
                  <select value={data.country} onChange={(e) => set('country', e.target.value)}>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="State" required error={errors.state}>
                  <select value={data.state} onChange={(e) => set('state', e.target.value)}>
                    <option value="">Select state</option>
                    {STATES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="City" required error={errors.city}>
                  <select value={data.city} onChange={(e) => set('city', e.target.value)}>
                    <option value="">Select city</option>
                    {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="District">
                  <input type="text" value={data.district} onChange={(e) => set('district', e.target.value)} />
                </Field>
                <Field label="Pincode">
                  <input type="text" value={data.pincode} onChange={(e) => set('pincode', e.target.value)} />
                </Field>
              </div>
            )}

            {activeTab === 'identification' && (
              <div className="ef-grid">
                <p className="ef-section-note">All identification fields are optional and never appear on employee cards.</p>
                <Field label="Aadhaar Number"><input type="text" value={data.aadhaar} onChange={(e) => set('aadhaar', e.target.value)} /></Field>
                <Field label="PAN Number"><input type="text" value={data.pan} onChange={(e) => set('pan', e.target.value)} /></Field>
                <Field label="UAN Number"><input type="text" value={data.uan} onChange={(e) => set('uan', e.target.value)} /></Field>
                <Field label="PF Number"><input type="text" value={data.pf} onChange={(e) => set('pf', e.target.value)} /></Field>
                <Field label="ESI Number"><input type="text" value={data.esi} onChange={(e) => set('esi', e.target.value)} /></Field>
                <Field label="Passport Number"><input type="text" value={data.passport} onChange={(e) => set('passport', e.target.value)} /></Field>
                <Field label="Driving License"><input type="text" value={data.drivingLicense} onChange={(e) => set('drivingLicense', e.target.value)} /></Field>
              </div>
            )}

            {activeTab === 'skills' && (
              <div className="ef-section">
                <div className="ef-tag-input">
                  {data.skills.map((s) => (
                    <span className="emp-tag emp-tag-removable" key={s}>
                      {s}
                      <button type="button" aria-label={`Remove ${s}`} onClick={() => removeSkill(s)}>×</button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={skillInput}
                    placeholder="Type a skill and press Enter"
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput) }
                    }}
                  />
                </div>
                <div className="ef-skill-suggestions">
                  {SKILLS_LIST.filter((s) => !data.skills.includes(s)).map((s) => (
                    <button key={s} type="button" className="emp-tag emp-tag-suggestion" onClick={() => addSkill(s)}>
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'education' && (
              <div className="ef-section">
                {data.education.length === 0 && <p className="ef-section-note">No education records yet.</p>}
                {data.education.map((row) => (
                  <div className="ef-repeat-card" key={row.id}>
                    <div className="ef-grid">
                      <Field label="Degree"><input type="text" value={row.degree} onChange={(e) => updateEducation(row.id, 'degree', e.target.value)} /></Field>
                      <Field label="Institution"><input type="text" value={row.institution} onChange={(e) => updateEducation(row.id, 'institution', e.target.value)} /></Field>
                      <Field label="Specialization"><input type="text" value={row.specialization} onChange={(e) => updateEducation(row.id, 'specialization', e.target.value)} /></Field>
                      <Field label="Start Year"><input type="text" value={row.startYear} onChange={(e) => updateEducation(row.id, 'startYear', e.target.value)} /></Field>
                      <Field label="End Year"><input type="text" value={row.endYear} onChange={(e) => updateEducation(row.id, 'endYear', e.target.value)} /></Field>
                      <Field label="Grade / CGPA"><input type="text" value={row.grade} onChange={(e) => updateEducation(row.id, 'grade', e.target.value)} /></Field>
                    </div>
                    <button type="button" className="emp-link-btn ef-remove-row" onClick={() => removeEducation(row.id)}>Remove record</button>
                  </div>
                ))}
                <button type="button" className="emp-btn-outline" onClick={addEducation}>+ Add Education</button>
              </div>
            )}

            {activeTab === 'experience' && (
              <div className="ef-section">
                {data.experience.length === 0 && <p className="ef-section-note">No previous experience records yet.</p>}
                {data.experience.map((row) => (
                  <div className="ef-repeat-card" key={row.id}>
                    <div className="ef-grid">
                      <Field label="Previous Company"><input type="text" value={row.company} onChange={(e) => updateExperience(row.id, 'company', e.target.value)} /></Field>
                      <Field label="Designation"><input type="text" value={row.designation} onChange={(e) => updateExperience(row.id, 'designation', e.target.value)} /></Field>
                      <Field label="Start Date"><input type="date" value={row.startDate} onChange={(e) => updateExperience(row.id, 'startDate', e.target.value)} /></Field>
                      <Field label="End Date"><input type="date" value={row.endDate} onChange={(e) => updateExperience(row.id, 'endDate', e.target.value)} /></Field>
                      <Field label="Years of Experience"><input type="text" value={row.years} onChange={(e) => updateExperience(row.id, 'years', e.target.value)} /></Field>
                      <Field label="Responsibilities">
                        <textarea rows={2} value={row.responsibilities} onChange={(e) => updateExperience(row.id, 'responsibilities', e.target.value)} />
                      </Field>
                    </div>
                    <button type="button" className="emp-link-btn ef-remove-row" onClick={() => removeExperience(row.id)}>Remove record</button>
                  </div>
                ))}
                <button type="button" className="emp-btn-outline" onClick={addExperience}>+ Add Experience</button>
              </div>
            )}

            {activeTab === 'bank' && (
              <div className="ef-grid">
                <p className="ef-section-note">Optional at creation — payroll will rely on these once completed.</p>
                <Field label="Account Holder Name">
                  <input type="text" value={data.bankDetails.accountHolderName} onChange={(e) => setBank('accountHolderName', e.target.value)} />
                </Field>
                <Field label="Bank Name">
                  <input type="text" value={data.bankDetails.bankName} onChange={(e) => setBank('bankName', e.target.value)} />
                </Field>
                <Field label="Account Number">
                  <input type="text" value={data.bankDetails.accountNumber} onChange={(e) => setBank('accountNumber', e.target.value)} />
                </Field>
                <Field label="IFSC Code">
                  <input type="text" value={data.bankDetails.ifsc} onChange={(e) => setBank('ifsc', e.target.value)} />
                </Field>
                <Field label="Branch">
                  <input type="text" value={data.bankDetails.branch} onChange={(e) => setBank('branch', e.target.value)} />
                </Field>
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="ef-section">
                {data.documents.length === 0 && <p className="ef-section-note">No documents added yet.</p>}
                {data.documents.map((row) => (
                  <div className="ef-repeat-card" key={row.id}>
                    <div className="ef-grid">
                      <Field label="Document Type">
                        <select value={row.type} onChange={(e) => updateDocument(row.id, 'type', e.target.value)}>
                          {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </Field>
                      <Field label="Document Number">
                        <input type="text" value={row.number} onChange={(e) => updateDocument(row.id, 'number', e.target.value)} />
                      </Field>
                      <Field label="Issue Date">
                        <input type="date" value={row.issueDate} onChange={(e) => updateDocument(row.id, 'issueDate', e.target.value)} />
                      </Field>
                      <Field label="Expiry Date">
                        <input type="date" value={row.expiryDate} onChange={(e) => updateDocument(row.id, 'expiryDate', e.target.value)} />
                      </Field>
                      <Field label="Attachment">
                        <div className="ef-file-row">
                          <button type="button" className="emp-btn-outline" onClick={() => simulateUpload(row.id)}>
                            {row.fileName ? 'Replace file' : 'Simulate upload'}
                          </button>
                          {row.fileName && <span className="ef-file-name">{row.fileName}</span>}
                        </div>
                      </Field>
                    </div>
                    <button type="button" className="emp-link-btn ef-remove-row" onClick={() => removeDocument(row.id)}>Remove document</button>
                  </div>
                ))}
                <button type="button" className="emp-btn-outline" onClick={addDocument}>+ Add Document</button>
              </div>
            )}

          </div>

          <div className="ef-actions">
            <button type="button" className="emp-btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="emp-btn-primary">{isEdit ? 'Save Changes' : 'Save Employee'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}