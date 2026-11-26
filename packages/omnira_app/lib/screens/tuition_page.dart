import 'package:flutter/material.dart';
import '../services/api.dart';
import '../theme.dart';

String tuitionMoney(dynamic cents) => '₱${((cents as num) / 100).toStringAsFixed(2)}';

class TuitionBalanceCard extends StatefulWidget {
  final Api api;
  const TuitionBalanceCard({super.key, required this.api});
  @override State<TuitionBalanceCard> createState() => _TuitionBalanceCardState();
}

class _TuitionBalanceCardState extends State<TuitionBalanceCard> {
  late Future<dynamic> balance;
  @override void initState() { super.initState(); balance = widget.api.get('/tuition/balance'); }
  @override Widget build(BuildContext context) => FutureBuilder<dynamic>(future: balance, builder: (context, snapshot) => Card(
    child: ListTile(
      contentPadding: const EdgeInsets.all(18),
      title: const Text('Pending tuition balance', style: TextStyle(color: navy, fontWeight: FontWeight.bold)),
      subtitle: Padding(padding: const EdgeInsets.only(top: 12), child: Text(snapshot.hasData ? '${tuitionMoney(snapshot.data['amount_centavos'])}\nView balance and payment options' : snapshot.hasError ? 'Balance unavailable' : 'Loading balance…')),
      trailing: const Icon(Icons.chevron_right),
      onTap: snapshot.hasData ? () async {
        await Navigator.of(context).push(MaterialPageRoute(builder: (_) => TuitionPage(api: widget.api)));
        if (mounted) setState(() => balance = widget.api.get('/tuition/balance'));
      } : null,
    ),
  ));
}

class TuitionPage extends StatefulWidget {
  final Api api;
  const TuitionPage({super.key, required this.api});
  @override State<TuitionPage> createState() => _TuitionPageState();
}

class _TuitionPageState extends State<TuitionPage> {
  late Future<dynamic> balance;
  String stage = 'detail';
  String method = 'qr';
  bool submitting = false;
  Map<String, dynamic>? request;
  @override void initState() { super.initState(); balance = widget.api.get('/tuition/balance'); }
  Future<void> submit() async {
    setState(() => submitting = true);
    try {
      final result = await widget.api.post('/tuition/payment-requests', {'method': method});
      if (!mounted) return;
      setState(() { request = Map<String, dynamic>.from(result as Map); stage = 'confirmation'; balance = widget.api.get('/tuition/balance'); });
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$error')));
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }
  @override Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(stage == 'method' ? 'Payment method' : stage == 'confirmation' ? 'Payment request' : 'Tuition balance')),
    body: FutureBuilder<dynamic>(future: balance, builder: (context, snapshot) {
      if (!snapshot.hasData) return Center(child: snapshot.hasError ? Text('Could not load balance: ${snapshot.error}') : const CircularProgressIndicator());
      final data = Map<String, dynamic>.from(snapshot.data as Map);
      final requests = data['payment_requests'] as List? ?? [];
      return ListView(padding: const EdgeInsets.all(18), children: [
        Card(child: Padding(padding: const EdgeInsets.all(22), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(stage == 'confirmation' ? 'Request created' : 'Pending tuition balance', style: const TextStyle(color: Colors.blueGrey)),
          const SizedBox(height: 9),
          Text(stage == 'confirmation' ? '#${request?['id'] ?? '—'}' : tuitionMoney(data['amount_centavos']), style: const TextStyle(color: navy, fontSize: 28, fontWeight: FontWeight.bold)),
          if (stage == 'confirmation') const Padding(padding: EdgeInsets.only(top: 10), child: Text('Demo request only. No money was charged.')),
        ]))),
        const SizedBox(height: 16),
        if (stage == 'detail') ...[
          if ((data['amount_centavos'] as num) > 0) SizedBox(width: double.infinity, child: FilledButton(onPressed: () => setState(() => stage = 'method'), child: const Text('Pay online'))),
          const SizedBox(height: 20),
          const Text('Payment requests', style: TextStyle(color: navy, fontWeight: FontWeight.bold)),
          if (requests.isEmpty) const ListTile(title: Text('No payment requests yet.')),
          ...requests.map((item) => Card(child: ListTile(title: Text('${item['method']}'.replaceAll('_', ' ')), subtitle: Text('Request #${item['id']} · ${item['status']}'), trailing: Text(tuitionMoney(item['amount_centavos']))))),
        ] else if (stage == 'method') ...[
          const Text('Choose a payment method', style: TextStyle(color: navy, fontWeight: FontWeight.bold)),
          for (final option in const [('qr', 'QR payment', Icons.qr_code), ('debit_card', 'Debit card', Icons.credit_card), ('ewallet', 'E-wallet', Icons.account_balance_wallet)])
            Card(child: RadioListTile<String>(title: Text(option.$2), secondary: Icon(option.$3), value: option.$1, groupValue: method, onChanged: (value) => setState(() => method = value!))),
          const SizedBox(height: 8),
          SizedBox(width: double.infinity, child: FilledButton(onPressed: submitting ? null : submit, child: Text(submitting ? 'Creating request…' : 'Continue'))),
        ] else SizedBox(width: double.infinity, child: FilledButton(onPressed: () => setState(() => stage = 'detail'), child: const Text('View balance'))),
        const SizedBox(height: 15),
        const Text('Demo checkout only. A payment provider must be connected before QR, debit card, or e-wallet charges can be processed.', style: TextStyle(color: Colors.blueGrey, fontSize: 12)),
      ]);
    }),
  );
}
