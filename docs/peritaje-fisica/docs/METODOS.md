# Métodos científicos, ecuaciones, supuestos y referencias (`METODOS.md`)

Todos los módulos se implementan en ES modules puros (`.mjs`), en unidades SI en sus interfaces, exigiendo explícitamente todo parámetro sin fuente universal (sin valores por defecto ocultos) y etiquetando toda salida con `basis`.

---

## 1. Peritaje ciudadano multimodal (`citizen-report.mjs`, `report-forensics.mjs`, `report-protocol.mjs`)

- **Autenticación y cadena de evidencia:** firmas Ed25519 (WebCrypto) sobre JSON canónico determinista; encadenamiento SHA-256 con `prevHash`, `rawSha256` y `entryHash` que cubre metadatos y dato crudo. Separación estricta entre `OBSERVED`, `ABSENT` y `COLLECTION_ERROR`.
- **Reutilización perceptual (`dHash-64`):** reducción a $9\times 8$ en luminancia (Rec. 601), comparación horizontal de píxeles adyacentes y distancia de Hamming de 64 bits (Krawetz 2013).
- **Barometría ISA:** altitud barométrica estándar $z = 44330\,\big(1 - (P/P_0)^{1/5.255}\big)$ (ISO 2533:1975).
- **Desprendimientos por lluvia y pendiente:** pendiente topográfica por Horn (1981), *Proc. IEEE* 69(1):14–47; umbral global intensidad-duración de Caine (1980), *Geografiska Annaler A* 62(1–2):23–27, DOI `10.1080/04353676.1980.11879996` ($I = 14.82\,D^{-0.39}$) y umbral mediterráneo/europeo de Guzzetti et al. (2008), *Landslides* 5(1):3–17, DOI `10.1007/s10346-007-0112-1`.
- **Teledetección:** pasos orbitales con TLE reales (`orbital.mjs`), índices espectrales Sentinel-2 $\text{NDVI}=(B8-B4)/(B8+B4)$, $\text{NDWI}=(B3-B8)/(B3+B8)$ (McFeeters 1996, *Int. J. Remote Sensing* 17(7):1425–1432, DOI `10.1080/01431169608948714`), $\text{NBR}=(B8A-B12)/(B8A+B12)$ y $\text{dNBR}$ (Key & Benson 2006, USDA FS RMRS-GTR-164-CD); respaldo radar Sentinel-1 SAR con cobertura nubosa.
- **Fiabilidad del informante sin PII:** algoritmo EM de Dawid & Skene (1979), *J. R. Stat. Soc. C* 28(1):20–28, DOI `10.2307/2346806`, operando únicamente sobre seudónimos criptográficos derivados de la clave pública.
- **Actualización bayesiana y anti-doble-conteo:** actualización log-odds con decaimiento exponencial temporal y deduplicación por seudónimo, grupo (`groupHint`), ráfaga colocalizada y foto compartida (`cross-source.mjs`, `source-evidence.mjs`).

## 2. Asimilación de datos de campo (`data-assimilation.mjs`)

- **Puerta de admisión:** solo se asimilan observaciones con nivel `N2–N5`, sin contradicción verificada y con incertidumbre declarada $\sigma_{\text{obs}} > 0$.
- **Filtro de Kalman por Conjuntos estocástico (EnKF):**
  $$\mathbf{X}_a = \mathbf{X}_f + (\mathbf{L} \circ \mathbf{P}_f \mathbf{H}^\top)\big(\mathbf{H}(\mathbf{L} \circ \mathbf{P}_f)\mathbf{H}^\top + \mathbf{R}\big)^{-1}\big(\mathbf{D} - \mathbf{H}\mathbf{X}_f\big)$$
  con observaciones perturbadas $\mathbf{D}$ (Burgers, van Leeuwen & Evensen 1998, *Mon. Wea. Rev.* 126:1719–1724, DOI `10.1175/1520-0493(1998)126<1719:ASITEK>2.0.CO;2`; Evensen 1994, *JGR* 99:10143–10162, DOI `10.1029/94JC00572`; Evensen 2003, *Ocean Dynamics* 53:343–367, DOI `10.1007/s10236-003-0036-9`), inflación multiplicativa de covarianza (Anderson & Anderson 1999) y matriz de localización espacial compacta $\mathbf{L}$ de Gaspari & Cohn (1999), *Q. J. R. Meteorol. Soc.* 125(554):723–757, DOI `10.1002/qj.49712555417`.

## 3. Inundación 2D de volúmenes finitos bien equilibrado (`shallow-water-fv.mjs`)

- **Ecuaciones de Saint-Venant 2D con porosidad urbana anisotrópica (Sanders, Schubert & Gallegos 2008, *Adv. Water Resour.* 31(11):1445–1460, DOI `10.1016/j.advwatres.2008.07.012`):**
  $$\partial_t(\phi h) + \partial_x(\psi_x h u) + \partial_y(\psi_y h v) = q_{\text{in}}$$
  $$\partial_t(\phi h u) + \partial_x\big(\psi_x(h u^2 + \tfrac{1}{2} g h^2)\big) + \partial_y(\psi_y h u v) = -g\psi h\,\partial_x z + \tfrac{1}{2}g h^2 \partial_x\psi - S_{\text{fric},x}$$
- **Reconstrucción hidrostática bien equilibrada y preservación de positividad:** $z^* = \max(z_L, z_R)$, $h_L^* = \max(0, h_L + z_L - z^*)$, $h_R^* = \max(0, h_R + z_R - z^*)$ (Audusse et al. 2004, *SIAM J. Sci. Comput.* 25(6):2050–2065, DOI `10.1137/S1064827503431090`), con término exacto de reacción hidrostática de muros urbanos y paredes reflectantes para C-property exacta (`< 1e-12`).
- **Solver de Riemann HLLC:** onda de contacto transversal $S_*$ (Toro, Spruce & Speares 1994, *Shock Waves* 4:25–34, DOI `10.1007/BF01414629`).
- **Fricción semi-implícita estable en frente seco/mojado:** factor $1 / (1 + \Delta t (g n^2 |\mathbf{u}| h^{-4/3} + \tfrac{1}{2} c_D |\mathbf{u}|))$ (Liang & Marche 2009, *Adv. Water Resour.* 32(6):873–884, DOI `10.1016/j.advwatres.2009.02.010`).
- **Acondicionamiento hidrológico del MDS:** apertura monótona de falsos tapones de puentes/terraplenes (Lindsay & Dhun 2015, *Int. J. Geogr. Inf. Sci.* 29(3):397–419, DOI `10.1080/13658816.2014.975715`) e incisión subcelda declarada (Neal, Schumann & Bates 2012, *Water Resour. Res.* 48, W11506, DOI `10.1029/2012WR012514`).
- **Estabilidad humana y vehicular:** Cox, Shand & Blacka (2010, ARR Project 10 WRL TR 2010/06); DEFRA / Environment Agency (2006, FD2320/TR2: $\text{HR} = d(v + 0.5) + \text{DF}$); Shand et al. (2011, WRL TR 2011/01) y Martínez-Gomariz et al. (2018, *Natural Hazards* 92:1533–1554, DOI `10.1007/s11069-018-3262-8`).
- **Ámbito y supuestos:** presión hidrostática, fluido incompresible sin arrastre de sedimentos hiperconcentrado ni obstrucción dinámica de ojos de puente.

## 4. Propagación de incendios forestales (`fire-rothermel.mjs`)

- **Velocidad de propagación superficial:** Rothermel (1972, USDA FS INT-115), correcciones de carga dinámica herbácea de Albini (1976, INT-30) y Andrews (2018, RMRS-GTR-371, DOI `10.2737/RMRS-GTR-371`):
  $$R = \frac{I_R\,\xi\,(1 + \phi_W + \phi_S)}{\rho_b\,\varepsilon\,Q_{ig}}$$
- **Modelos de combustible:** 22 modelos publicados de Scott & Burgan (2005, USDA FS RMRS-GTR-153, DOI `10.2737/RMRS-GTR-153`), intensidad lineal y longitud de llama de Byram (1959, $L = 0.0775\,I_B^{0.46}$).
- **Frente 2D Level-Set con elipse de Huygens:** ecuación de Hamilton-Jacobi $\partial_t\phi + F(\mathbf{x},\hat{\mathbf{n}})|\nabla\phi| = 0$ (Osher & Sethian 1988, *J. Comput. Phys.* 79(1):12–49, DOI `10.1016/0021-9991(88)90002-2`) con función de soporte elíptica exacta $F(\hat{\mathbf{n}}) = c(\hat{\mathbf{n}}\cdot\hat{\mathbf{e}}) + \sqrt{a^2(\hat{\mathbf{n}}\cdot\hat{\mathbf{e}})^2 + b^2(1 - (\hat{\mathbf{n}}\cdot\hat{\mathbf{e}})^2)}$ (Richards 1990, DOI `10.1002/nme.1620300606`; Finney 1998, RMRS-RP-4, DOI `10.2737/RMRS-RP-4`; relación $L/B$ de Anderson 1983, INT-305) y anclaje de interfaz en reinicialización (Russo & Smereka 2000).
- **Ámbito y supuestos:** fuego superficial continuo; no modela focos secundarios por pavesas a larga distancia ni fuego activo de copas.

## 5. Física ferroviaria (`rail-physics-etcs.mjs`)

- **Curvas de frenado ETCS:** UNISIG / ERA SUBSET-026-3 Baseline 3 Release 2 (v3.6.0, §3.13): curvas EBD, EBI (con compensación de corte de tracción $T_{\text{traction}}, A_{\text{est}}$ y establecimiento $T_{\text{be}}$), SBD, SBI, Warning, Permitted e Indication incluyendo aceleración por pendiente $a_{\text{grad}} = g \cdot (\text{pendiente}\;‰ / 1000)$.
- **Pandeo térmico en barra larga soldada (CWR):** Kish & Samavedam (2013, US DOT/FRA/ORD-13/01): compresión térmica $P_T = 2EA\alpha\Delta T$ y fuerzas/temperaturas críticas superior $T_{B,\max}$ e inferior $T_{B,\min}$ derivadas del balance energético de viga sobre balasto elastoplástico ($P \propto \sqrt{2 E I_z F / w}$ con corrección de curvatura $1/R$).
- **Descarrilamiento y ripado de vía:** criterio de Nadal (1908) $(Y/Q)_{\lim} = (\tan\beta - \mu)/(1 + \mu\tan\beta)$, Weinstock (1984, ASME 84-WA/RT-1) $|Y_1/Q_1| + |Y_2/Q_2| \le (Y/Q)_{\text{Nadal}} + \mu$, Prud'homme (1967) $H_{\lim} = \alpha(10 + P_0/3)$ y límites CEN EN 14363:2016+A1:2018.
- **Límite de seguridad funcional:** herramienta de análisis y auditoría externa; **no** es equipamiento vital embarcado SIL-4 (EN 50126/50128/50129).

## 6. Radio avanzada sobre relieve (`radio-propagation-advanced.mjs`)

- **Espacio libre Friis** y **filo de cuchillo ITU-R P.526-15 §4.2** ($J(v)$).
- **Delta-Bullington completo (ITU-R P.526-15 §4.5.2, P.452-17, P.1812-6):** $L_d = L_{ba} + \max(0, L_{\text{sph}} - L_{bs})$ con ajuste de Tierra lisa por mínimos cuadrados y difracción esférica §3.1.1.
- **Cascada Epstein-Peterson (1953, DOI `10.1109/JRPROC.1953.274401`)**, **irregularidad $\Delta h$ y horizontes radioeléctricos Longley-Rice/ITM (NTIA Report 82-100, Hufford, Longley & Kissick 1982)**, **clutter ITU-R P.2108-1 §3.2** y **vegetación ITU-R P.833-10**.

## 7. Incertidumbre transversal, enrutamiento y gobernanza (`uncertainty-uq.mjs`, `emergency-routing-zones.mjs`, `triage-governance.mjs`)

- **Hipercubo Latino (LHS):** McKay, Beckman & Conover (1979, *Technometrics* 21(2):239–245, DOI `10.1080/00401706.1979.10489755`) con inversa normal de Acklam (2003).
- **Sensibilidad global de Sobol:** diseño cruzado de Saltelli et al. (2010, *Comput. Phys. Commun.* 181(2):259–270, DOI `10.1016/j.cpc.2009.09.018`) y estimadores de Jansen (1999).
- **Puntuaciones estrictamente propias:** Brier (1950) y CRPS empírico (Gneiting & Raftery 2007, *JASA* 102(477):359–378, DOI `10.1198/016214506000001437`).
- **Enrutamiento de evacuación:** A* con heurística Haversine admisible (Hart, Nilsson & Raphael 1968), puertas físicas Cox/DEFRA/Shand y densidad peatonal crítica de Fruin (1971).
- **Gobernanza epistémica:** grafo dirigido tipado, consenso determinista de 4 especialistas (Física, Operaciones, Forense, Auditor Adversario) y verificación de invariantes STRIDE + MITRE ATT&CK + MITRE ATLAS.
