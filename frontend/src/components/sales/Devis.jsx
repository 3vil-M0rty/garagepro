import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { format, addDays } from 'date-fns';

/**
 * Devis — professional A4 quote/invoice document.
 * IMPORTANT: must always render a non-null DOM node so react-to-print can
 * find content. The outer wrapper is always rendered; inner content switches
 * on type/sale/loan props.
 */
const Devis = forwardRef(({ sale, loan, type = 'sale', settings = {} }, ref) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const isEN  = i18n.language === 'en';

  const garageName    = settings.garage_name     || 'GaragePro';
  const garageAddress = settings.garage_address  || '';
  const garagePhone   = settings.garage_phone    || '';
  const garageLogo    = settings.garage_logo_url || '';
  const garageIce     = settings.garage_ice      || '';
  const garageRc      = settings.garage_rc       || '';
  const validityDays  = parseInt(settings.quote_validity_days || '30', 10);

  const fmt = (n) => {
    const num = Number(n) || 0;
    if (isEN) return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
    return num.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
  };

  const fmtDate = (d) => {
    try { return format(new Date(d || Date.now()), 'dd/MM/yyyy'); } catch { return '—'; }
  };

  /* ── Always render a wrapper so ref is never null ── */
  return (
    <div ref={ref} style={{ fontFamily: isRTL ? 'Cairo, Arial, sans-serif' : 'Arial, sans-serif' }}>
      {type === 'loan' && loan ? (
        /* ── LOAN SLIP ─────────────────────────────────────────────── */
        <div dir={isRTL ? 'rtl' : 'ltr'} style={{
          fontSize: '12px', color: '#000', background: '#fff',
          padding: '16mm 12mm', width: '210mm', minHeight: '297mm', boxSizing: 'border-box',
        }}>
          <DevisHeader
            garageName={garageName} garageAddress={garageAddress} garagePhone={garagePhone}
            garageLogo={garageLogo} garageIce={garageIce} garageRc={garageRc}
            docType={t('loans.loanSlip')}
            docNumber={loan._id?.slice(-8).toUpperCase()}
            docDate={fmtDate(loan.lentAt)}
            isRTL={isRTL}
          />
          <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
            <InfoBox label={t('loans.borrowerInfo')} lines={[
              loan.borrowerName,
              loan.borrowerPhone,
              t(`loans.${loan.borrowerType || 'client'}`),
            ]} />
            <InfoBox label={t('loans.depositInfo')} lines={[
              `${t('loans.deposit')}: ${fmt(loan.depositAmount || 0)}`,
              `${t('loans.lentAt')}: ${fmtDate(loan.lentAt)}`,
              loan.expectedReturnAt ? `${t('loans.returnBefore')}: ${fmtDate(loan.expectedReturnAt)}` : '',
            ]} />
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <Th>{t('print.serial')}</Th>
                <Th>{t('print.product')}</Th>
                <Th>{t('print.condition')}</Th>
                <Th align="right">{t('print.deposit')}</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td>{loan.unitSerial || loan.unit?.serialNumber || '—'}</Td>
                <Td>{loan.productName || loan.unit?.product?.name || '—'}</Td>
                <Td>{loan.unit?.condition ? t(`condition.${loan.unit.condition}`) : '—'}</Td>
                <Td align="right">{fmt(loan.depositAmount || 0)}</Td>
              </tr>
            </tbody>
          </table>
          <SignatureBlock sellerLabel={t('print.seller')} clientLabel={t('print.clientSig')} />
          <Footer
            thankYou={t('print.thankYou')}
            extra={loan.expectedReturnAt ? `${t('loans.returnBefore')}: ${fmtDate(loan.expectedReturnAt)}` : ''}
          />
        </div>
      ) : sale ? (
        /* ── SALE DEVIS ────────────────────────────────────────────── */
        <div dir={isRTL ? 'rtl' : 'ltr'} style={{
          fontSize: '12px', color: '#000', background: '#fff',
          padding: '16mm 12mm', width: '210mm', minHeight: '297mm', boxSizing: 'border-box',
        }}>
          <DevisHeader
            garageName={garageName} garageAddress={garageAddress} garagePhone={garagePhone}
            garageLogo={garageLogo} garageIce={garageIce} garageRc={garageRc}
            docType={t('sales.devis')}
            docNumber={sale.quoteNumber || sale.receiptNumber}
            docDate={fmtDate(sale.createdAt)}
            isRTL={isRTL}
          />

          {/* Client + meta */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
            <InfoBox label={t('sales.clientInfo')} lines={[
              sale.clientName || '—',
              sale.clientPhone || '',
              sale.clientAddress || '',
            ]} />
            <InfoBox label={t('sales.validUntil')} lines={[
              `${t('sales.date')}: ${fmtDate(sale.createdAt)}`,
              `${t('sales.validUntil')}: ${fmtDate(addDays(new Date(sale.createdAt || Date.now()), validityDays))}`,
              `${t('sales.paymentInfo')}: ${formatPayment(sale.paymentMethod, t)}`,
            ]} />
          </div>

          {/* Items table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: '#1e293b', color: '#fff' }}>
                <Th light={false}>#</Th>
                <Th light={false}>{t('sales.reference')}</Th>
                <Th light={false}>{t('sales.designation')}</Th>
                <Th light={false} align="center">{t('sales.qte')}</Th>
                <Th light={false} align="right">{t('sales.prixUnitaire')}</Th>
                <Th light={false} align="right">{t('sales.montantHT')}</Th>
              </tr>
            </thead>
            <tbody>
              {(sale.items || []).map((item, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#f8fafc' : '#fff' }}>
                  <Td>{i + 1}</Td>
                  <Td><span style={{ fontFamily: 'monospace', fontSize: '10px' }}>{item.productSku || '—'}</span></Td>
                  <Td><strong>{item.productName}</strong></Td>
                  <Td align="center">{item.quantity}</Td>
                  <Td align="right">{fmt(item.unitPrice)}</Td>
                  <Td align="right"><strong>{fmt(item.totalPrice)}</strong></Td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <table style={{ width: '240px', fontSize: '11px', borderCollapse: 'collapse' }}>
              <tbody>
                <TotalRow label={t('sales.totalHT')} value={fmt(sale.subtotal)} />
                {(sale.discount || 0) > 0 && <TotalRow label={t('sales.discount')} value={`- ${fmt(sale.discount)}`} />}
                {(sale.tax || 0) > 0 && <TotalRow label={t('sales.totalTVA')} value={fmt(sale.tax)} />}
                <TotalRow label={t('sales.totalTTC')} value={fmt(sale.total)} bold />
              </tbody>
            </table>
          </div>

          {sale.notes && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '8px', marginBottom: '16px', fontSize: '11px', color: '#475569' }}>
              <strong>{t('sales.notes')} :</strong> {sale.notes}
            </div>
          )}

          <SignatureBlock sellerLabel={t('print.seller')} clientLabel={t('print.clientSig')} />
          <Footer thankYou={t('print.thankYou')} />
        </div>
      ) : (
        /* ── Placeholder so ref never returns null ─────────────────── */
        <div style={{ padding: '1px' }} />
      )}
    </div>
  );
});

Devis.displayName = 'Devis';
export default Devis;

/* ── Sub-components ──────────────────────────────────────────────────────── */

function DevisHeader({ garageName, garageAddress, garagePhone, garageLogo, garageIce, garageRc, docType, docNumber, docDate, isRTL }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '2px solid #1e293b', paddingBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {garageLogo && (
          <img src={garageLogo} alt="Logo" style={{ height: '50px', objectFit: 'contain' }}
            onError={e => { e.target.style.display = 'none'; }} />
        )}
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '16px', letterSpacing: '0.5px' }}>{garageName}</div>
          {garageAddress && <div style={{ color: '#475569', fontSize: '11px' }}>{garageAddress}</div>}
          {garagePhone   && <div style={{ color: '#475569', fontSize: '11px' }}>Tél: {garagePhone}</div>}
          {garageIce     && <div style={{ color: '#475569', fontSize: '10px' }}>ICE: {garageIce}</div>}
          {garageRc      && <div style={{ color: '#475569', fontSize: '10px' }}>RC: {garageRc}</div>}
        </div>
      </div>
      <div style={{ textAlign: isRTL ? 'left' : 'right' }}>
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', letterSpacing: '1px' }}>{docType}</div>
        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>N° : <strong>{docNumber}</strong></div>
        <div style={{ fontSize: '11px', color: '#64748b' }}>Date : <strong>{docDate}</strong></div>
      </div>
    </div>
  );
}

function InfoBox({ label, lines }) {
  return (
    <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '4px', padding: '8px', fontSize: '11px' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#1e293b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      {lines.filter(Boolean).map((l, i) => <div key={i} style={{ color: '#374151' }}>{l}</div>)}
    </div>
  );
}

function Th({ children, align = 'left', light = true }) {
  return (
    <th style={{
      padding: '6px 8px', textAlign: align, fontWeight: 'bold',
      background: light ? '#f1f5f9' : '#1e293b',
      color: light ? '#374151' : '#fff',
      border: '1px solid #e2e8f0', fontSize: '10px',
    }}>{children}</th>
  );
}

function Td({ children, align = 'left' }) {
  return (
    <td style={{ padding: '5px 8px', textAlign: align, border: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
      {children}
    </td>
  );
}

function TotalRow({ label, value, bold = false }) {
  return (
    <tr>
      <td style={{ padding: '4px 8px', color: '#374151', fontSize: '11px', fontWeight: bold ? 'bold' : 'normal' }}>{label}</td>
      <td style={{
        padding: '4px 8px', textAlign: 'right',
        fontWeight: bold ? 'bold' : 'normal',
        fontSize: bold ? '13px' : '11px',
        color: bold ? '#1e293b' : '#374151',
        borderTop: bold ? '2px solid #1e293b' : 'none',
      }}>{value}</td>
    </tr>
  );
}

function SignatureBlock({ sellerLabel, clientLabel }) {
  return (
    <div style={{ display: 'flex', gap: '24px', marginTop: '32px', marginBottom: '16px' }}>
      {[sellerLabel, clientLabel].map((label, i) => (
        <div key={i} style={{ flex: 1, borderTop: '1px solid #94a3b8', paddingTop: '6px' }}>
          <div style={{ fontSize: '10px', color: '#64748b', textAlign: 'center' }}>{label}</div>
          <div style={{ height: '48px' }} />
        </div>
      ))}
    </div>
  );
}

function Footer({ thankYou, extra }) {
  return (
    <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '8px', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
      {extra && <div style={{ marginBottom: '4px', color: '#dc2626', fontWeight: 'bold' }}>{extra}</div>}
      <div>{thankYou}</div>
    </div>
  );
}

function formatPayment(method, t) {
  const map = { cash: t('sales.cash'), card: t('sales.card'), transfer: t('sales.transfer'), check: t('sales.check'), other: t('sales.other') };
  return map[method] || method || '—';
}