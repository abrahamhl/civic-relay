# Exact Erasure Tails and Delay Bounds for Store-Carry-Forward Emergency Messaging

## Abstract

Offline emergency messaging combines two uncertainties: a message split into
shards is reconstructible only if enough shards arrive, and a store-carry-forward
relay delivers only when a contact occurs. This report derives the exact
reconstruction probability for independent and heterogeneous shard success,
the exact delay distribution for independent relay copies under Poisson
contacts, and conservative Chernoff and Hoeffding bounds for the erasure tail.
We show where the bounds are useful and where they overprovision. Numerical
tables are generated from the SENDA reference implementation and are model
outputs, not field measurements. The report is a technical reference for the
offline stack; it does not claim that the independence or exponential-contact
assumptions hold in a particular deployment.

**Keywords:** erasure coding, Poisson-binomial, delay-tolerant networking,
Chernoff bound, Hoeffding bound, offline messaging.

## 1. Introduction

A store-carry-forward system does not have an end-to-end path. It has contacts,
copies, storage, and time [@fall; @jain; @spray]. Two design questions dominate:

1. **Reconstruction.** If a message is encoded into $n$ shards and any $k$ shards
   suffice [@rizzo; @reed], what is the probability that at least $k$ shards
   arrive?
2. **Deadline.** If several independent copies circulate and contacts are
   Poisson, what is the probability that at least one copy is delivered by a
   deadline $t$?

The first question is a binomial tail when shard successes are iid, and a
Poisson-binomial tail when they are not [@wang]. The second is the distribution of the
minimum of independent exponential contact times. Both have closed forms. The
engineering temptation is to replace them with a simple bound; that is sometimes
right and sometimes expensive.

This report makes the assumptions explicit, derives the formulas used by the
SENDA precision lab, and quantifies the gap between exact tails and two standard
bounds. Section 2 states the model. Section 3 derives erasure tails. Section 4
derives delay. Section 5 derives bounds. Section 6 reports numerical tables.
Section 7 gives guidance. Section 8 lists limitations.

## 2. Model and assumptions

We use the following assumptions.

- **A1 (Shard independence).** Shard delivery indicators
  $X_1,\dots,X_n$ are independent Bernoulli random variables.
- **A2 (Homogeneity, optional).** In the iid case, $\Pr(X_i=1)=p$ for all $i$.
  In the heterogeneous case, $\Pr(X_i=1)=p_i$.
- **A3 (Poisson contacts).** For each relay copy, contact times form a Poisson
  process with rate $\lambda>0$; copies are independent.
- **A4 (No correlation, no recovery).** A failed shard is not retransmitted
  within the modeled window, and contact events do not correlate across copies.

A1 and A4 are strong. Real outages cluster, and copies may share a vehicle or a
power source. The formulas below are therefore a baseline, not a field
prediction. A deployment that observes correlation should replace $p_i$ with a
correlated model or report the gap as a sensitivity.

## 3. Exact erasure tails

### 3.1 Independent and identically distributed shards

Let $K=\sum_{i=1}^n X_i$ with $X_i\sim\mathrm{Bernoulli}(p)$ independent. Then
$K\sim\mathrm{Binomial}(n,p)$ and

$$
\Pr(K \ge k) = \sum_{j=k}^{n} \binom{n}{j} p^j (1-p)^{n-j}.
\tag{1}
$$

**Theorem 1.** Under A1 and A2, the reconstruction probability of a
$k$-of-$n$ erasure code is given by (1).

The proof is the definition of the binomial distribution. The formula is exact
in real arithmetic; the implementation evaluates the terms in log space and
clamps the result to $[0,1]$ to control floating-point error.

### 3.2 Heterogeneous shards

When shard success probabilities differ, $K$ is Poisson-binomial:

$$
\Pr(K = j) = \sum_{\substack{S\subseteq\{1,\dots,n\}\\ |S|=j}}
\prod_{i\in S} p_i \prod_{i\notin S} (1-p_i).
\tag{2}
$$

Direct enumeration is exponential. The standard dynamic program is
$O(n^2)$.

**Theorem 2.** Let $f_i(j)=\Pr(\sum_{m=1}^{i} X_m = j)$ with $f_0(0)=1$ and
$f_0(j)=0$ for $j\neq0$. Then

$$
f_{i+1}(j) = f_i(j)(1-p_{i+1}) + f_i(j-1)p_{i+1},
\tag{3}
$$

and $\Pr(K\ge k)=\sum_{j=k}^{n} f_n(j)$.

*Proof.* Condition on $X_{i+1}$. If it fails, the first $i$ variables must sum
to $j$; if it succeeds, they must sum to $j-1$. The events are disjoint and
exhaustive. ∎

The SENDA implementation stores the distribution as a length-$i+1$ array and
updates it in place per shard. For $n\le255$ the memory is negligible.

### 3.3 Numerical notes

- For small $p$ and large $n$, direct powers underflow. The iid implementation
  computes each term as
  $\exp(\log\Gamma(n+1)-\log\Gamma(j+1)-\log\Gamma(n-j+1)+j\log p+(n-j)\log(1-p))$.
- The heterogeneous DP avoids underflow longer because it multiplies
  probabilities rather than exponentiating large log-factorials, but it can
  still underflow for very small tail probabilities. A log-domain DP is the
  correct next step if tails below $10^{-300}$ matter.
- Clamping to $[0,1]$ hides a negative round-off but does not fix a bad model.
  A production verifier should report the unclamped value and a tolerance.

## 4. Delay under Poisson contacts

### 4.1 One copy

Let $T_1$ be the first contact time of a copy with rate $\lambda$. Then
$\Pr(T_1>t)=e^{-\lambda t}$, so

$$
F_{T_1}(t)=1-e^{-\lambda t},\qquad \mathbb{E}[T_1]=\frac{1}{\lambda}.
\tag{4}
$$

### 4.2 Independent copies

Let $T=\min(T_1,\dots,T_m)$ for $m$ independent copies with the same rate
$\lambda$. The minimum is exponential with rate $m\lambda$:

$$
\Pr(T>t)=\prod_{i=1}^{m}\Pr(T_i>t)=e^{-m\lambda t}.
\tag{5}
$$

**Theorem 3.** Under A3, with $m$ independent copies of rate $\lambda$,

$$
F_T(t)=1-e^{-m\lambda t},\qquad
\mathbb{E}[T]=\frac{1}{m\lambda},\qquad
q_\alpha=\frac{-\ln(1-\alpha)}{m\lambda}.
\tag{6}
$$

*Proof.* The survival product is (5). The CDF is its complement. The mean and
quantiles follow from the exponential distribution. ∎

The reference implementation uses (6) directly. It reports the median
($\alpha=0.5$), the 90th percentile, and the 99th percentile.

### 4.3 Per-contact delivery probability

If a contact occurs but the transfer succeeds only with probability $q$, the
effective contact process is thinned to rate $\lambda q$. Replacing
$\lambda$ by $\lambda q$ in (6) gives

$$
F_T(t)=1-e^{-m\lambda q t}.
\tag{7}
$$

Equation (7) is the model to use when contacts are noisy. The current reference
implementation exposes the $q=1$ case; the extension is a substitution, not a
new derivation.

### 4.4 Combined erasure and delay

If reconstruction requires $k$ of $n$ shards and each shard has an independent
deadline-$t$ delivery probability $p(t)=1-e^{-\lambda q t}$ (one copy per
shard), then the reconstruction probability by $t$ is the binomial tail (1)
with $p=p(t)$. With $m$ copies per shard, use
$p(t)=1-e^{-m\lambda q t}$. This composition assumes independence between
shards and copies; it is the natural baseline, not a theorem about a real
network.

## 5. Conservative bounds

### 5.1 Chernoff bound

For $X\sim\mathrm{Binomial}(n,p)$ and $a=k/n>p$, the Chernoff bound [@chernoff] is

$$
\Pr(X\ge k) \le \exp\left(-n\,D(a\|p)\right),
\qquad
D(a\|p)=a\ln\frac{a}{p}+(1-a)\ln\frac{1-a}{1-p}.
\tag{8}
$$

*Proof sketch.* For $t>0$, Markov’s inequality gives
$\Pr(X\ge k)\le e^{-tk}(1-p+pe^t)^n$. Minimizing the exponent over $t$ yields
$e^t=a(1-p)/(p(1-a))$ and the KL divergence $D(a\|p)$. ∎

For $a<p$, the same bound applies to the lower tail with $D(a\|p)$.

### 5.2 Hoeffding bound

Hoeffding’s inequality [@hoeffding] gives, for $\epsilon>0$,

$$
\Pr(X\ge n(p+\epsilon))\le e^{-2n\epsilon^2}.
\tag{9}
$$

With $a=k/n$, set $\epsilon=a-p$. The bound is looser than Chernoff because it
uses only the range of the Bernoulli variable, not its variance.

### 5.3 When to use which

- Use the exact tail when $n\le255$ and the independence assumption is
  defensible. It is cheap and avoids unnecessary redundancy.
- Use Chernoff for a quick conservative design when $n$ is large or when only a
  bound is needed.
- Use Hoeffding when its simpler form is required for an analytical argument,
  and accept the extra conservatism.
- Never present a bound as an exact probability. The display contract should
  say `≤` or `<`, not `=`.

## 6. Numerical study

All values below are computed by the SENDA reference implementation. They are
model outputs under A1–A4, not measurements. Tables are reproducible with
`node scripts/research/paper2-tables.mjs`.

### 6.1 Homogeneous erasure tail

$n=32$, $p=0.2$. The exact tail is compared with Chernoff (8) and Hoeffding
(9).

| $k$ | Exact $\Pr(K\ge k)$ | Chernoff bound | Hoeffding bound |
|---:|---:|---:|---:|
| 8 | 0.301763 | 0.789604 | 0.852144 |
| 10 | 0.0898324 | 0.323430 | 0.444858 |
| 12 | 0.0167163 | 0.0738217 | 0.140858 |
| 14 | 0.00195246 | 0.00986601 | 0.0270518 |
| 16 | 0.000143595 | 0.000792282 | 0.00315111 |
| 20 | $1.89197\times10^{-7}$ | $1.12643\times10^{-6}$ | $9.54016\times10^{-6}$ |

The bounds are valid but increasingly conservative. At $k=12$ the Chernoff
bound is about $4.4$ times the exact tail; Hoeffding is about $8.4$ times.
Designing to the bound overprovisions redundancy.

### 6.2 Heterogeneous erasure tail

$n=32$, $p_i=0.15+0.01(i-1)$ for $i=1,\dots,32$, so the probabilities range from
$0.15$ to $0.46$. The exact Poisson-binomial tail is computed by (3).

| $k$ | Exact $\Pr(K\ge k)$ |
|---:|---:|
| 10 | 0.531164 |
| 12 | 0.243764 |
| 14 | 0.0740366 |
| 16 | 0.0144282 |
| 18 | 0.00176455 |
| 20 | 0.000132207 |

A homogeneous model with the mean probability
$\bar p=0.305$ would not reproduce this tail; heterogeneity matters most in the
upper tail.

### 6.3 Delay by deadline

$\lambda=0.2$ contacts per hour, independent copies, $q=1$. The probability
column is $1-e^{-m\lambda t}$; the percentiles are in hours.

| Copies $m$ | Deadline $t$ (h) | $\Pr(T\le t)$ | Mean | Median | P90 | P99 |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 6 | 0.698806 | 5.000 | 3.466 | 11.513 | 23.026 |
| 1 | 12 | 0.909282 | 5.000 | 3.466 | 11.513 | 23.026 |
| 1 | 24 | 0.991770 | 5.000 | 3.466 | 11.513 | 23.026 |
| 2 | 6 | 0.909282 | 2.500 | 1.733 | 5.756 | 11.513 |
| 2 | 12 | 0.991770 | 2.500 | 1.733 | 5.756 | 11.513 |
| 3 | 6 | 0.972676 | 1.667 | 1.155 | 3.838 | 7.675 |
| 3 | 12 | 0.999253 | 1.667 | 1.155 | 3.838 | 7.675 |
| 5 | 6 | 0.997521 | 1.000 | 0.693 | 2.303 | 4.605 |
| 5 | 12 | 0.999994 | 1.000 | 0.693 | 2.303 | 4.605 |

Doubling copies halves the expected delay but does not make the tail free: the
99th percentile also halves. The cost is linear in copies.

### 6.4 Erasure overhead

$k$-of-$n$ with overhead $n/k=1.5$.

| $k$ | $n$ | $p$ | $\Pr(K\ge k)$ | Expected received |
|---:|---:|---:|---:|---:|
| 8 | 12 | 0.4 | 0.0573099 | 4.8 |
| 8 | 12 | 0.6 | 0.438178 | 7.2 |
| 8 | 12 | 0.8 | 0.927445 | 9.6 |
| 12 | 18 | 0.6 | 0.374277 | 10.8 |
| 16 | 24 | 0.6 | 0.327922 | 14.4 |

At $p=0.6$ and $50\%$ overhead, the reconstruction probability is below one
half. The expected number of received shards is $7.2<8$, which is a useful
warning: a mean above the threshold is not enough, because the threshold is a
tail event.

## 7. Engineering guidance

1. **Separate the model from the claim.** Publish $n$, $k$, $p_i$, $\lambda$,
   $m$, and $q$ as inputs. Publish the tail as an exact value or a bound with an
   explicit inequality.
2. **Prefer exact tails in the supported range.** For $n\le255$ the DP or
   log-sum is cheap. A bound is a design aid, not a substitute for the exact
   value.
3. **Report heterogeneity.** A single mean $p$ can hide a much heavier tail when
   shard probabilities vary.
4. **Do not confuse expected received shards with success probability.** The
   threshold is a tail, not a mean.
5. **Treat Poisson contacts as a baseline.** If contacts cluster, the
   exponential model underestimates long delays.
6. **State the deadline and the copies in the display.** “99% by 12 hours with
   3 copies” is checkable; “reliable” is not.

## 8. Limitations

- Independence (A1) and exponential contacts (A3) are modeling assumptions.
- The reference implementation uses double-precision arithmetic, not exact
  rational arithmetic. The formulas are exact; the computed values are not.
- The $O(n^2)$ Poisson-binomial DP is appropriate for the supported $n\le255$;
  larger systems need a faster or log-domain method.
- Correlation, retransmission, storage limits, and adversarial drop are outside
  the model.
- The numerical tables are not field data and must not be cited as operational
  evidence.

## 9. Conclusion

The exact erasure tail and the exponential delay distribution are simple enough
to implement and verify offline. The main risk is not the formula; it is
silently replacing it with a mean or a loose bound and then treating the result
as a promise. PCI-style claims make the inputs, the method, the inequality, and
the provenance explicit, so a reviewer can see which assumption is doing the
work.

## References

[@chernoff]: H. Chernoff. “A measure of asymptotic efficiency for tests of a
hypothesis based on the sum of observations.” Annals of Mathematical Statistics,
23(4):493–507, 1952.

[@hoeffding]: W. Hoeffding. “Probability inequalities for sums of bounded random
variables.” Journal of the American Statistical Association, 58(301):13–30,
1963.

[@rizzo]: L. Rizzo. “Effective erasure codes for reliable computer communication
protocols.” ACM SIGCOMM Computer Communication Review, 27(2):24–36, 1997.

[@reed]: I. S. Reed and G. Solomon. “Polynomial codes over certain finite
fields.” Journal of the Society for Industrial and Applied Mathematics,
8(2):300–304, 1960.

[@fall]: K. Fall. “A delay-tolerant network architecture for challenged
internets.” Proceedings of SIGCOMM 2003, pp. 27–34.

[@jain]: S. Jain, K. Fall, and R. Patra. “Routing in a delay tolerant network.”
Proceedings of SIGCOMM 2004, pp. 145–158.

[@spray]: T. Spyropoulos, K. Psounis, and C. S. Raghavendra. “Spray and wait: An
efficient routing scheme for intermittently connected mobile networks.”
Proceedings of WDTN 2005, pp. 252–259.

[@wang]: Y. H. Wang. “On the number of successes in independent trials.”
Statistica Sinica, 3:295–312, 1993.

## Appendix A — Reproduction

```bash
node scripts/research/paper2-tables.mjs
```

The script imports the same functions used by the precision lab, writes a JSON
artifact under `public/research/data/`, and prints the tables above. It performs
no network access.
