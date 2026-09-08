import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {Router, ActivatedRoute, RouterOutlet, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Worker } from '../../models/worker.model';
import { WorkersService } from '../../shared/workers/workers.service';
import { TransactionsService } from '../../shared/transactions/transactions.service';
import { Transaction } from '../../models/transaction.model';
import { BaseModal } from '../../layout/base-modal/base-modal';
import { WorkerStats } from "./worker-stats/worker-stats";
import { AccountCyclesService } from '../../shared/account-cycles/account-cycles.service';
import { AccountCycle } from '../../models/account-cycle.model';
import { WorkerProduction } from '../../models/worker-production.model';





@Component({
  selector: 'app-worker-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BaseModal, RouterOutlet, WorkerStats, RouterLink],
  templateUrl: './worker-details.html',
  styleUrl: './worker-details.css'
})
export class WorkerDetails implements OnInit {

  // ============================================
  // ✅ Dependencies
  // ============================================

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly workersService = inject(WorkersService);
  private readonly transactionsService = inject(TransactionsService);
  private fb = inject(FormBuilder);
  private readonly accountCyclesService = inject(AccountCyclesService);

   // ============================================
// ✅ Delete Modal
// ============================================

showDeleteModal = signal(false);

selectedProduction = signal<WorkerProduction | null>(null);

  // ============================================
  // ✅ Signals - Worker
  // ============================================

  worker = signal<Worker | null>(null);
  // Keep the parent's signal separate from the child's @Input() with the
  // same conceptual name. This prevents routed-component input assignment
  // from ever replacing the signal itself.
   currentCycle = signal<AccountCycle | null>(null);

  loading = signal(false);
  paymentSuccess = signal(false);
 
  // ============================================
  // ✅ Signals - Statistics
  // ============================================


  
  
  totalEarned = signal(0);

  production = signal<WorkerProduction[]>([]);

  summaryGrandTotal = computed(() =>
    this.production().reduce((sum, item) => sum + (item.total ?? 0), 0)
  );
  // ============================================
// ✅ Total Paid
// ============================================

totalPaid = computed(() => {

    return this.payments().reduce(

        (sum, payment) => sum + payment.amount,

        0

    );

});




// ============================================
// ✅ Payment Modal
// ============================================

showPaymentModal = signal(false);

// ============================================
// ✅ Editing Payment
// ============================================

editingPayment = signal<Transaction | null>(null);

// ============================================
// ✅ Delete Payment
// ============================================

selectedPayment = signal<Transaction | null>(null);

showDeletePaymentModal = signal(false);
  
  
 

// ============================================
// ✅ Worker Payments
// ============================================

payments = signal<Transaction[]>([]);
paymentForm: FormGroup = this.fb.group({

  amount: [0, [Validators.required, Validators.min(1)]],

  date: [
    new Date().toISOString().substring(0,10),
    Validators.required
  ],

  note: ['']

});


  private activeChild: any = null;

  private syncChildInputs(): void {
    if (!this.activeChild) return;

    // PieceWorker and TailorWorker expose `worker` as a signal, while
    // MonthlyWorker uses a regular @Input. Do not replace a signal with its
    // current value, otherwise later calls to `worker.set()` will fail.
    if (typeof this.activeChild.worker?.set === 'function') {
      this.activeChild.worker.set(this.worker());
    } else {
      this.activeChild.worker = this.worker();
    }

    if (typeof this.activeChild.currentCycle?.set === 'function') {
      this.activeChild.currentCycle.set(this.currentCycle());
    } else if ('currentCycle' in this.activeChild) {
      this.activeChild.currentCycle = this.currentCycle();
    }
  }


onChildActivate(component: any): void {

  this.activeChild = component;

  // ============================================
  // Send current cycle to child
  // ============================================

  this.syncChildInputs();

  // ============================================
  // Production Changed
  // ============================================

  if (component.productionChanged) {

    component.productionChanged.subscribe(() => {

      const id = this.route.snapshot.paramMap.get('id');

      if (id) {
        this.loadWorker(Number(id));
      }

    });

  }

  // ============================================
  // Start Cycle
  // ============================================

  if (component.startCycle) {

    component.startCycle.subscribe(() => {

      this.startWorkerCycle();

    });

  }

}


startWorkerCycle(): void {

  const worker = this.worker();

  if (!worker?.id) {
    return;
  }

  const workerId = worker.id;

  this.accountCyclesService
    .startAccountCycle('worker', workerId)
    .subscribe({

      next: (response) => {

        console.log('Worker cycle started:', response);

        this.loadWorker(workerId);

      },

      error: (error) => {

        console.error('Failed to start worker cycle:', error);

      }

    });

}


// ============================================
// ✅ Payment Modal
// ============================================

addPayment(): void {
     
    this.showPaymentModal.set(true);
    

}








  // ============================================
  // ✅ Init
  // ============================================

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) return;
    this.loadWorker(id);
    
  }
  

  // ============================================
  // ✅ Load Worker
  // ============================================

  private loadWorker(id: number): void {



  this.loading.set(true);

  this.workersService
    .getWorkerDetails(id)
    .subscribe({

     next: (response) => {

  this.worker.set(response.worker);

  this.currentCycle.set(response.currentCycle ?? null);

  this.syncChildInputs();

  this.production.set(response.productions);

  this.payments.set(response.payments ?? []);

  // ============================================
  // ✅ Refresh child production
  // ============================================

  if (this.activeChild?.loadProduction) {
    this.activeChild.loadProduction();
  }

  this.router.navigate([response.worker.paymentType], {
    relativeTo: this.route,
    replaceUrl: true
  });

  this.loading.set(false);

},

      error: (error) => {

        console.error(error);

        this.loading.set(false);

      }

    });

}

  

 
  // ============================================
  // ✅ Go Back
  // ============================================

  goBack(): void {
    history.back();
  }
  

// ============================================
// ✅ Financial Summary
// ============================================

totalDue = computed(() => {

    return this.worker()?.paymentType === 'monthly'
      ? this.worker()?.monthlySalary ?? 0
      : this.summaryGrandTotal();

});

   

debt = computed(() => {

    return this.totalDue() - this.totalPaid();

});




// ============================================
// ✅ Load Worker Payments
// ============================================

  loadPayments(): void {
   
    const worker = this.worker();

    if (!worker?.id) return;

    this.workersService.getWorkerDetails(worker.id).subscribe({
      next: (response) => {
        this.payments.set(response.payments ?? []);
      },
      error: (error) => {
        console.error('Failed to load worker payments:', error);
      }
    });

}

// ============================================
// ✅ Open Payment Modal
// ============================================

openPaymentModal(): void {

    this.showPaymentModal.set(true);

}

// ============================================
// ✅ Close Payment Modal
// ============================================

closePaymentModal(): void {

    this.showPaymentModal.set(false);

    this.paymentSuccess.set(false);

    this.paymentForm.reset({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        note: ''
    });

}
// ============================================
  // ✅ Payments
  // ============================================

  

  
  savePayment(): void {
    if (this.paymentForm.invalid) return;

    const paymentData = this.paymentForm.value;

    if (this.editingPayment()) {

    // Update Transaction
     const payment = this.editingPayment()!;

        const dto: Transaction = {
    id: payment.id!,
    type: 'salary',
    direction: 'OUT',
    amount: paymentData.amount,
    entityType: 'worker',
    entityId: this.worker()!.id!,
    note: paymentData.note ?? '',
    transactionDate: paymentData.date ?? '',
    status: 'completed'
};
        this.transactionsService
            .updateTransaction(payment.id!, dto)
            .subscribe(() => {

    const id = Number(this.route.snapshot.paramMap.get('id'));

    this.loadPayments();

    this.loadWorker(id);

    this.paymentSuccess.set(true);

    setTimeout(() => {

        this.paymentSuccess.set(false);

        this.closePaymentModal();

    }, 3000);

});

} else {

    // Create Transaction

     this.transactionsService
      .createTransaction({
        type: 'salary',
        direction: 'OUT',
        amount: paymentData.amount,
        entityType: 'worker',
        entityId: this.worker()?.id!,
        note: paymentData.note|| '',
        transactionDate: paymentData.date|| '',
        status: 'completed'

      })
      .subscribe({
        next: () => {
          this.paymentSuccess.set(true);

          // Refresh the cycle as well as the payments. The backend may close
          // the open cycle after this payment reaches the full balance.
          const id = this.worker()?.id;
          if (id) {
            this.loadWorker(id);
          }

          setTimeout(() => {

            this.paymentSuccess.set(false);

            this.closePaymentModal();

          }, 3000);
          this.loadPayments();
        },
        error: (error) => {
          console.error(error);
        }
      });

}

   
  }

  // ============================================
  // ✅ Print Page
  // ============================================

 printPage(): void {
  // ============================================
  // 1. Get current data
  // ============================================
  const worker = this.worker();
  const cycle = this.currentCycle();
  const productions = this.production();
  const payments = this.payments();

  // ============================================
  // 2. Validate data
  // ============================================
  if (!worker) {
    console.error('No worker data available');
    return;
  }

  if (!cycle) {
    console.error('No current cycle available');
    return;
  }

  // ============================================
  // 3. Calculate totals
  // ============================================
  const totalProduction = productions.reduce((sum, p) => sum + (p.total || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = totalProduction - totalPaid;
  const debt = this.debt();

  // ============================================
  // 4. Build statement HTML
  // ============================================
  const cycleName = `Cycle ${cycle.id}`;
  const cycleDate = cycle.openedAt 
    ? new Date(cycle.openedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : '';

  const productionCount = productions.length;
  const paymentCount = payments.length;

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="ltr" lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Worker Statement - ${worker.name}</title>
      <style>
        /* ============================================
           Reset & Base Styles
           ============================================ */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          padding: 24px;
          background: #ffffff;
          color: #1a1a2e;
          line-height: 1.6;
          max-width: 1100px;
          margin: 0 auto;
        }

        /* ============================================
           Print Styles
           ============================================ */
        @media print {
          body {
            padding: 16px;
            font-size: 11px;
          }
          
          .no-print {
            display: none !important;
          }
          
          table {
            font-size: 11px;
          }
          
          .header {
            border-bottom-width: 2px;
            margin-bottom: 16px;
          }
          
          .info-section {
            padding: 10px;
            margin-bottom: 16px;
          }
          
          .summary-section {
            padding: 10px;
          }
          
          .footer {
            margin-top: 24px;
            padding-top: 12px;
          }
        }

        /* ============================================
           Header
           ============================================ */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 4px solid #2563eb;
          padding-bottom: 16px;
          margin-bottom: 24px;
        }

        .logo {
          flex-shrink: 0;
        }

        .logo img {
          height: 60px;
          width: auto;
        }

        .title {
          text-align: center;
          flex: 1;
        }

        .title h1 {
          font-size: 26px;
          color: #0f172a;
          margin-bottom: 4px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .title h2 {
          font-size: 20px;
          color: #334155;
          font-weight: 500;
        }

        .title .subtitle {
          font-size: 14px;
          color: #64748b;
          font-weight: 400;
          margin-top: 2px;
        }

        /* ============================================
           Info Section
           ============================================ */
        .info-section {
          background: #f8fafc;
          border-radius: 10px;
          padding: 18px 20px;
          margin-bottom: 24px;
          border: 1px solid #e2e8f0;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 8px 24px;
        }

        .info-item {
          display: flex;
          align-items: center;
          padding: 4px 0;
        }

        .info-item .label {
          font-weight: 600;
          color: #475569;
          margin-right: 8px;
          font-size: 13px;
          min-width: 80px;
        }

        .info-item .value {
          color: #0f172a;
          font-weight: 500;
          font-size: 13px;
        }

        .info-item .badge {
          display: inline-block;
          padding: 2px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .badge-open {
          background: #dcfce7;
          color: #16a34a;
        }

        .badge-closed {
          background: #fee2e2;
          color: #dc2626;
        }

        /* ============================================
           Table Section
           ============================================ */
        .table-section {
          margin-bottom: 24px;
        }

        .table-section .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          padding-bottom: 6px;
          border-bottom: 2px solid #e2e8f0;
        }

        .table-section h3 {
          font-size: 17px;
          color: #0f172a;
          font-weight: 600;
        }

        .table-section .count-badge {
          background: #e2e8f0;
          padding: 2px 12px;
          border-radius: 20px;
          font-size: 13px;
          color: #475569;
          font-weight: 500;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        table thead th {
          background: #f1f5f9;
          color: #334155;
          font-weight: 600;
          padding: 10px 14px;
          text-align: left;
          border: 1px solid #e2e8f0;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        table tbody td {
          padding: 9px 14px;
          border: 1px solid #e2e8f0;
          color: #1e293b;
        }

        table tbody tr:nth-child(even) {
          background: #fafbfc;
        }

        table tbody tr:hover {
          background: #f1f5f9;
        }

        .total-row td {
          background: #f1f5f9;
          font-weight: 700;
          color: #0f172a;
          border-top: 2px solid #94a3b8;
        }

        .text-center {
          text-align: center;
          color: #94a3b8;
          font-style: italic;
          padding: 20px !important;
        }

        .text-right {
          text-align: right;
        }

        .text-muted {
          color: #94a3b8;
          font-size: 12px;
        }

        /* ============================================
           Monthly Salary Section
           ============================================ */
        .monthly-salary-section {
          background: #f8fafc;
          border-radius: 10px;
          padding: 18px 20px;
          margin-bottom: 24px;
          border: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .monthly-salary-section .label {
          font-weight: 600;
          color: #475569;
          font-size: 15px;
        }

        .monthly-salary-section .value {
          font-weight: 700;
          color: #0f172a;
          font-size: 18px;
        }

        /* ============================================
           Summary Section
           ============================================ */
        .summary-section {
          background: #f1f5f9;
          border-radius: 10px;
          padding: 18px 20px;
          margin-top: 8px;
          border: 1px solid #e2e8f0;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
        }

        .summary-item .label {
          font-weight: 500;
          color: #475569;
          font-size: 14px;
        }

        .summary-item .value {
          font-weight: 700;
          color: #0f172a;
          font-size: 16px;
        }

        .summary-item.positive .value {
          color: #16a34a;
        }

        .summary-item.negative .value {
          color: #dc2626;
        }

        .summary-item.neutral .value {
          color: #2563eb;
        }

        .summary-item .status-icon {
          font-size: 18px;
          margin-right: 6px;
        }

        /* ============================================
           Footer
           ============================================ */
        .footer {
          margin-top: 32px;
          padding-top: 16px;
          border-top: 2px solid #e2e8f0;
          text-align: center;
          font-size: 12px;
          color: #94a3b8;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .footer .print-time {
          color: #94a3b8;
        }

        .footer .page-info {
          color: #94a3b8;
        }

        /* ============================================
           Utility Classes
           ============================================ */
        .mt-1 { margin-top: 8px; }
        .mb-1 { margin-bottom: 8px; }
        .fw-600 { font-weight: 600; }
        .fs-12 { font-size: 12px; }
        .color-slate { color: #64748b; }
      </style>
    </head>
    <body>
      <!-- ==========================================
           HEADER
           ========================================== -->
      <div class="header">
        <div class="logo">
          <img src="assets/logo.png" alt="Workshop Logo" height="60">
        </div>
        <div class="title">
          <h1>Worker Statement</h1>
          <h2>${worker.name}</h2>
          <div class="subtitle">Account Statement &amp; Balance Summary</div>
        </div>
      </div>

      <!-- ==========================================
           WORKER & CYCLE INFORMATION
           ========================================== -->
      <div class="info-section">
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Worker:</span>
            <span class="value">${worker.name}</span>
          </div>
          <div class="info-item">
            <span class="label">Phone:</span>
            <span class="value">${worker.phone || 'Not registered'}</span>
          </div>
          <div class="info-item">
            <span class="label">Payment Type:</span>
            <span class="value">${worker.paymentType === 'piece' ? 'Piecework' : worker.paymentType === 'tailor' ? 'Tailor' : 'Monthly'}</span>
          </div>
          <div class="info-item">
            <span class="label">Cycle:</span>
            <span class="value">${cycleName}</span>
          </div>
          ${cycleDate ? `
          <div class="info-item">
            <span class="label">Cycle Date:</span>
            <span class="value">${cycleDate}</span>
          </div>
          ` : ''}
          <div class="info-item">
            <span class="label">Status:</span>
            <span class="value">
              <span class="badge ${cycle.status === 'open' ? 'badge-open' : 'badge-closed'}">
                ${cycle.status === 'open' ? '● Open' : '● Closed'}
              </span>
            </span>
          </div>
        </div>
      </div>

      <!-- ==========================================
           PRODUCTION TABLE (for piecework & tailor)
           ========================================== -->
      ${worker.paymentType !== 'monthly' ? `
      <div class="table-section">
        <div class="section-header">
          <h3>Production</h3>
          <span class="count-badge">${productionCount} items</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Work Type</th>
              <th class="text-right">Quantity</th>
              <th class="text-right">Unit Price</th>
              <th class="text-right">Total</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${productions.length > 0 ? productions.map((p, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${p.workTypeName || 'Not specified'}</td>
                <td class="text-right">${p.quantity || 0}</td>
                <td class="text-right">${p.price || 0} USD</td>
                <td class="text-right">${p.total || 0} USD</td>
                <td>${p.productionDate ? new Date(p.productionDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}</td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="6" class="text-center">No production records found</td>
              </tr>
            `}
            <tr class="total-row">
              <td colspan="4"><strong>Total Production</strong></td>
              <td class="text-right"><strong>${totalProduction} USD</strong></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
      ` : `
      <!-- ==========================================
           MONTHLY SALARY
           ========================================== -->
      <div class="monthly-salary-section">
        <span class="label">Monthly Salary:</span>
        <span class="value">${worker.monthlySalary || 0} USD</span>
      </div>
      `}

      <!-- ==========================================
           PAYMENTS TABLE
           ========================================== -->
      <div class="table-section">
        <div class="section-header">
          <h3>Payments</h3>
          <span class="count-badge">${paymentCount} payments</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th class="text-right">Amount</th>
              <th>Type</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${payments.length > 0 ? payments.map((p, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${p.transactionDate ? new Date(p.transactionDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Not specified'}</td>
                <td class="text-right">${p.amount} USD</td>
                <td>${p.type === 'salary' ? 'Salary' : p.type === 'advance' ? 'Advance' : 'Other'}</td>
                <td>${p.note || '-'}</td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="5" class="text-center">No payment records found</td>
              </tr>
            `}
            <tr class="total-row">
              <td colspan="2"><strong>Total Payments</strong></td>
              <td class="text-right"><strong>${totalPaid} USD</strong></td>
              <td colspan="2"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ==========================================
           SUMMARY
           ========================================== -->
      <div class="summary-section">
        <div class="summary-grid">
         ${worker.paymentType !== 'monthly' ? `
    <div class="summary-item neutral">
      <span class="label">Total Production</span>
      <span class="value">${totalProduction} USD</span>
    </div>
  ` : ''}
          <div class="summary-item neutral">
            <span class="label">Total Payments</span>
            <span class="value">${totalPaid} USD</span>
          </div>
          <div class="summary-item ${debt > 0 ? 'negative' : debt < 0 ? 'positive' : 'neutral'}">
            <span class="label">Total Due</span>
            <span class="value">${debt} USD</span>
          </div>
          <div class="summary-item ${balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'neutral'}">
            <span class="label">Balance</span>
            <span class="value">${balance} USD</span>
          </div>
          <div class="summary-item ${balance === 0 ? 'positive' : 'neutral'}">
            <span class="label">Account Status</span>
            <span class="value">
              ${balance === 0 ? '✅ Settled' : balance > 0 ? '⚠️ Due' : '🔴 Overdue'}
            </span>
          </div>
        </div>
      </div>

      <!-- ==========================================
           FOOTER
           ========================================== -->
      <div class="footer">
        <span class="print-time">Printed: ${new Date().toLocaleString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</span>
        <span class="page-info">Worker Statement &bull; ${worker.name}</span>
      </div>
    </body>
    </html>
  `;

  // ============================================
  // 5. Open print window
  // ============================================
  const printWindow = window.open('', '_blank', 'width=1100,height=900,scrollbars=yes');

  if (!printWindow) {
    console.error('Failed to open print window');
    return;
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  printWindow.onload = function() {
    printWindow.focus();
    
    // Small delay to ensure styles are applied
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };
}
  // ============================================
// ✅ Edit Payment
// ============================================

editPayment(payment: Transaction): void {

    this.editingPayment.set(payment);

    this.paymentForm.patchValue({

        amount: payment.amount,
        date: payment.transactionDate,
        note: payment.note

    });

    this.paymentSuccess.set(false);

    this.showPaymentModal.set(true);

}

// ============================================
// ✅ Delete Payment
// ============================================

deletePayment(payment: Transaction): void {

    this.selectedPayment.set(payment);

    this.showDeletePaymentModal.set(true);

}
// ============================================
// ✅ Close Delete Payment Modal
// ============================================

closeDeletePaymentModal(): void {

    this.showDeletePaymentModal.set(false);

    this.selectedPayment.set(null);

}
// ============================================
// ✅ Confirm Delete Payment
// ============================================

confirmDeletePayment(): void {

    const payment = this.selectedPayment();

    if (!payment) return;

    this.transactionsService
        .deleteTransaction(payment.id!)
        .subscribe({

            next: () => {

                this.loadPayments();

                this.closeDeletePaymentModal();

            },

            error: (err) => {

                console.error(err);

            }

        });

}
}
