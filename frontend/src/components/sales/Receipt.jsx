import { forwardRef } from 'react';
import { format } from 'date-fns';

const Receipt = forwardRef(({ sale, garageName = 'GaragePro' }, ref) => {
  if (!sale) return null;

  const fmt = (n) => new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 2 }).format(n);
  const line = '─'.repeat(32);

  return (
    <div ref={ref} className="receipt-print bg-white text-black p-4 font-mono text-xs" style={{ width: '58mm', fontSize: '11px' }}>
      {/* Header */}
      <div className="text-center mb-3">
        <div className="font-bold text-base uppercase tracking-widest">{garageName}</div>
        <div className="text-gray-500 text-xs">Pièces Auto & Garage</div>
        <div className="text-gray-400 text-xs mt-0.5">Tel: +212 6XX XXX XXX</div>
        <div className="border-t border-dashed border-gray-300 mt-2 pt-2">
          <div>{format(new Date(sale.createdAt || Date.now()), 'dd/MM/yyyy HH:mm')}</div>
          <div className="font-bold">{sale.receiptNumber}</div>
        </div>
      </div>

      <div className="border-t border-dashed border-gray-300 my-2" />

      {/* Seller */}
      <div className="text-xs text-gray-500 mb-2">
        Vendeur: {sale.sellerName || sale.seller?.username}
      </div>

      <div className="border-t border-dashed border-gray-300 mb-2" />

      {/* Items */}
      <div className="space-y-1.5">
        {sale.items?.map((item, i) => (
          <div key={i}>
            <div className="font-medium truncate">{item.productName}</div>
            <div className="flex justify-between text-gray-600">
              <span>{item.quantity} x {fmt(item.unitPrice)}</span>
              <span className="font-medium text-black">{fmt(item.totalPrice)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-gray-300 my-2" />

      {/* Totals */}
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Sous-total</span>
          <span>{fmt(sale.subtotal)} MAD</span>
        </div>
        {sale.discount > 0 && (
          <div className="flex justify-between text-gray-500">
            <span>Remise</span>
            <span>-{fmt(sale.discount)} MAD</span>
          </div>
        )}
        {sale.tax > 0 && (
          <div className="flex justify-between text-gray-500">
            <span>TVA ({sale.tax && sale.subtotal ? Math.round(sale.tax/(sale.subtotal-(sale.discount||0))*100) : 20}%)</span>
            <span>+{fmt(sale.tax)} MAD</span>
          </div>
        )}
      </div>

      <div className="border-t border-gray-800 my-1.5" />

      <div className="flex justify-between font-bold text-sm">
        <span>TOTAL</span>
        <span>{fmt(sale.total)} MAD</span>
      </div>

      <div className="text-xs text-gray-500 mt-1">
        Paiement: {sale.paymentMethod === 'cash' ? 'Espèces' : sale.paymentMethod === 'card' ? 'Carte' : 'Virement'}
      </div>

      <div className="border-t border-dashed border-gray-300 my-2" />

      {/* Footer */}
      <div className="text-center text-xs text-gray-400 space-y-0.5">
        <div>Merci pour votre visite!</div>
        <div>شكراً على زيارتكم</div>
        <div className="mt-1 font-bold text-gray-600">{garageName}</div>
      </div>
    </div>
  );
});

Receipt.displayName = 'Receipt';
export default Receipt;
