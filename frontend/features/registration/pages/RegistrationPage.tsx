import { useEffect, useState } from 'react';
import {
  Button,
  InlineLoading,
  InlineNotification,
  ProgressBar,
  Stack,
  TextArea,
  TextInput,
} from '@carbon/react';
import { CheckmarkOutline, Document, Edit, Security } from '@carbon/icons-react';
import { hasPermission } from '../../access-control';
import type {
  InsuranceDetails,
  PortalData,
  ProfileSettings,
  RegistrationDemographics,
  RegistrationForm,
  RegistrationIntake,
} from '../../../shared/types';
import { registrationApi } from '../api';
import '../registration.scss';

export function RegistrationPage({
  fallbackProfile,
  fallbackInsurance,
  permissions,
  onUpdated,
}: {
  fallbackProfile: ProfileSettings;
  fallbackInsurance: PortalData['insuranceDetails'];
  permissions: string[];
  onUpdated: () => Promise<unknown>;
}) {
  const [intake, setIntake] = useState<RegistrationIntake | null>(null);
  const [demographics, setDemographics] = useState<RegistrationDemographics>(() => demographicsFromProfile(fallbackProfile));
  const [insurance, setInsurance] = useState<InsuranceDetails>(fallbackInsurance);
  const [formDrafts, setFormDrafts] = useState<Record<string, Record<string, string>>>({});
  const [signerName, setSignerName] = useState(fallbackProfile.fullName);
  const [saving, setSaving] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const canUpdate = hasPermission(permissions, 'registration.update');
  const canSign = hasPermission(permissions, 'registration.consent.sign');

  useEffect(() => {
    let alive = true;
    registrationApi.getIntake()
      .then((data) => {
        if (!alive) return;
        setIntake(data);
        setDemographics(data.demographics);
        setInsurance(data.insurance);
        setSignerName(data.demographics.fullName || fallbackProfile.fullName);
        setFormDrafts(Object.fromEntries(data.forms.map((form) => [form.id, form.fields])));
      })
      .catch((requestError) => {
        if (alive) setError(requestError instanceof Error ? requestError.message : 'Could not load registration intake.');
      });
    return () => {
      alive = false;
    };
  }, [fallbackProfile.fullName]);

  const saveDemographics = async () => {
    await save('demographics', async () => registrationApi.updateDemographics(demographics), 'Demographics saved.');
  };

  const saveInsurance = async () => {
    await save('insurance', async () => registrationApi.updateInsurance(insurance), 'Insurance information saved.');
  };

  const signConsent = async (consentId: string) => {
    await save(`consent-${consentId}`, async () => registrationApi.signConsent(consentId, signerName), 'Consent signed.');
  };

  const saveForm = async (form: RegistrationForm) => {
    await save(`form-${form.id}`, async () => registrationApi.updateForm(form.id, formDrafts[form.id] || {}, inferStatus(formDrafts[form.id])), `${form.title} saved.`);
  };

  const save = async (key: string, action: () => Promise<RegistrationIntake>, success: string) => {
    setSaving(key);
    setNotice('');
    setError('');
    try {
      const next = await action();
      setIntake(next);
      setDemographics(next.demographics);
      setInsurance(next.insurance);
      setFormDrafts(Object.fromEntries(next.forms.map((form) => [form.id, form.fields])));
      await onUpdated();
      setNotice(success);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save registration intake.');
    } finally {
      setSaving('');
    }
  };

  const updateDemographic = (field: keyof RegistrationDemographics, value: string) => {
    setDemographics((current) => ({ ...current, [field]: value }));
  };

  const updateInsurance = (field: keyof InsuranceDetails, value: string) => {
    setInsurance((current) => ({ ...current, [field]: value }));
  };

  const updateFormField = (formId: string, field: string, value: string) => {
    setFormDrafts((current) => ({
      ...current,
      [formId]: {
        ...(current[formId] || {}),
        [field]: value,
      },
    }));
  };

  const status = intake?.completion.status || 'Loading';
  const percent = intake?.completion.percent || 0;

  return (
    <main className="portal-main profile-settings-page registration-page">
      <section className="settings-title">
        <div>
          <p>Patient Portal / <strong>Registration</strong></p>
          <h1>Registration & Intake</h1>
          <span>Keep demographics, insurance, consent acknowledgements, and pre-visit intake current.</span>
        </div>
        <div className="page-actions">
          <span className={`status-pill status-pill--${percent === 100 ? 'good' : 'warning'}`}>{status}</span>
        </div>
      </section>

      {!intake && !error && <InlineLoading description="Loading registration intake" />}
      {notice && <p className="workspace-notice">{notice}</p>}
      {error && <InlineNotification kind="error" lowContrast title="Registration issue" subtitle={error} />}

      <section className="account-status registration-progress">
        <h2><CheckmarkOutline size={19} /> Intake Completion</h2>
        <ProgressBar label={`${percent}% complete`} value={percent} max={100} />
        <p><span>Completed steps</span><strong>{intake?.completion.completedSteps || 0} / {intake?.completion.totalSteps || 4}</strong></p>
        <p><span>Last updated</span><small>{intake?.updatedAt ? new Date(intake.updatedAt).toLocaleString() : 'Pending patient review'}</small></p>
      </section>

      <section className="profile-settings-shell">
        <section className="personal-info">
          <h2><Edit size={19} /> Demographics</h2>
          <div className="profile-field-grid">
            <TextInput id="reg-full-name" labelText="Full name" disabled={!canUpdate} value={demographics.fullName} onChange={(event) => updateDemographic('fullName', event.target.value)} />
            <TextInput id="reg-email" labelText="Email address" disabled={!canUpdate} value={demographics.email} onChange={(event) => updateDemographic('email', event.target.value)} />
            <TextInput id="reg-phone" labelText="Phone number" disabled={!canUpdate} value={demographics.phone} onChange={(event) => updateDemographic('phone', event.target.value)} />
            <TextInput id="reg-dob" labelText="Date of birth" disabled={!canUpdate} value={demographics.dateOfBirth} onChange={(event) => updateDemographic('dateOfBirth', event.target.value)} />
            <TextInput id="reg-language" labelText="Preferred language" disabled={!canUpdate} value={demographics.preferredLanguage} onChange={(event) => updateDemographic('preferredLanguage', event.target.value)} />
            <TextInput id="reg-emergency" labelText="Emergency contact" disabled={!canUpdate} value={demographics.emergencyContact} onChange={(event) => updateDemographic('emergencyContact', event.target.value)} />
            <TextInput className="wide" id="reg-address" labelText="Residential address" disabled={!canUpdate} value={demographics.address} onChange={(event) => updateDemographic('address', event.target.value)} />
          </div>
          <Button disabled={!canUpdate || saving === 'demographics'} onClick={saveDemographics}>{saving === 'demographics' ? 'Saving...' : 'Save demographics'}</Button>
        </section>

        <section className="insurance-details">
          <h2><Security size={19} /> Insurance</h2>
          <div className="profile-field-grid">
            <TextInput id="reg-ins-provider" labelText="Primary provider" disabled={!canUpdate} value={insurance.primaryProvider} onChange={(event) => updateInsurance('primaryProvider', event.target.value)} />
            <TextInput id="reg-ins-member" labelText="Member ID" disabled={!canUpdate} value={insurance.memberId} onChange={(event) => updateInsurance('memberId', event.target.value)} />
            <TextInput id="reg-ins-group" labelText="Group number" disabled={!canUpdate} value={insurance.groupNumber} onChange={(event) => updateInsurance('groupNumber', event.target.value)} />
            <TextInput id="reg-ins-holder" labelText="Policy holder" disabled={!canUpdate} value={insurance.policyHolder} onChange={(event) => updateInsurance('policyHolder', event.target.value)} />
            <TextInput id="reg-ins-active" labelText="Active through" disabled={!canUpdate} value={insurance.activeThrough} onChange={(event) => updateInsurance('activeThrough', event.target.value)} />
          </div>
          <Button disabled={!canUpdate || saving === 'insurance'} onClick={saveInsurance}>{saving === 'insurance' ? 'Saving...' : 'Save insurance'}</Button>
        </section>

        <section className="emergency-contacts">
          <h2><Document size={19} /> Consents</h2>
          <Stack gap={4}>
            <TextInput id="reg-signer" labelText="Signer name" disabled={!canSign} value={signerName} onChange={(event) => setSignerName(event.target.value)} />
            {(intake?.consents || []).map((consent) => (
              <article className="activity-row" key={consent.id}>
                <span className="activity-icon activity-icon--green"><Document size={18} /></span>
                <div>
                  <strong>{consent.title}</strong>
                  <p>{consent.description}</p>
                  <small>{consent.signedAt ? `Signed by ${consent.signerName} on ${new Date(consent.signedAt).toLocaleString()}` : 'Signature required'}</small>
                </div>
                <Button size="sm" disabled={!canSign || !signerName.trim() || saving === `consent-${consent.id}`} onClick={() => signConsent(consent.id)}>
                  {consent.signedAt ? 'Re-sign' : 'Sign'}
                </Button>
              </article>
            ))}
          </Stack>
        </section>

        {(intake?.forms || []).map((form) => (
          <section className="personal-info" key={form.id}>
            <h2><Document size={19} /> {form.title}</h2>
            <Stack gap={4}>
              {Object.entries(form.fields).map(([field]) => (
                <TextArea
                  id={`${form.id}-${field}`}
                  key={field}
                  labelText={labelFromField(field)}
                  disabled={!canUpdate}
                  value={formDrafts[form.id]?.[field] || ''}
                  onChange={(event) => updateFormField(form.id, field, event.target.value)}
                />
              ))}
              <Button disabled={!canUpdate || saving === `form-${form.id}`} onClick={() => saveForm(form)}>
                {saving === `form-${form.id}` ? 'Saving...' : `Save ${form.title}`}
              </Button>
            </Stack>
          </section>
        ))}
      </section>
    </main>
  );
}

function demographicsFromProfile(profile: ProfileSettings): RegistrationDemographics {
  return {
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    dateOfBirth: profile.dateOfBirth,
    address: profile.address,
    preferredLanguage: profile.language,
    emergencyContact: '',
  };
}

function inferStatus(fields: Record<string, string> = {}) {
  return Object.values(fields).some((value) => value.trim()) ? 'In Progress' : 'Not Started';
}

function labelFromField(field: string) {
  return field.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
}
