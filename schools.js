// schools.js — aula roster shared by index.html and acompanamiento.html.
// Each localidad maps to an array of { colegio, sede, jornada, clase, grado, dane }.
// Edit here ONCE; both pages pick up the change.
const SCHOOLS_BY_LOCALIDAD = {
  "ANTONIO NARIÑO": [
    { colegio: "COLEGIO ESCUELA NORMAL SUPERIOR DISTRITAL MARIA MONTESSORI (IED)", sede: "ANEXA A LA NORMAL SUPERIOR DISTRITAL MARIA MONTESSORI", jornada: "ÚNICA", clase: "804", grado: "8", dane: "11100101190802" },
    { colegio: "COLEGIO FRANCISCO DE PAULA SANTANDER (IED)", sede: "FRANCISCO DE PAULA SANTANDER", jornada: "ÚNICA", clase: "802", grado: "8", dane: "11100101463001" }
  ],
  "BARRIOS UNIDOS": [
    { colegio: "COLEGIO TECNICO DOMINGO FAUSTINO SARMIENTO (IED)", sede: "", jornada: "ÚNICA", clase: "702", grado: "7", dane: "111001008389" },
    { colegio: "COLEGIO TOMAS CARRASQUILLA (IED)", sede: "", jornada: "ÚNICA", clase: "701", grado: "7", dane: "111001032255" },
    { colegio: "COLEGIO FRANCISCO PRIMERO S.S. (IED)", sede: "SEDE B", jornada: "ÚNICA", clase: "902", grado: "9", dane: "11100102483002" }
  ],
  "BOSA": [
    { colegio: "COLEGIO ALFONSO LOPEZ MICHELSEN (IED)", sede: "", jornada: "MAÑANA", clase: "802", grado: "8", dane: "111001106950" },
    { colegio: "COLEGIO LUIS LOPEZ DE MESA (IED)", sede: "", jornada: "MAÑANA", clase: "802", grado: "8", dane: "111102000265" },
    { colegio: "COLEGIO ESMERALDA ARBOLEDA CADAVID (IED)", sede: "", jornada: "MAÑANA", clase: "803", grado: "8", dane: "111001801080" },
    { colegio: "COLEGIO LA CONCEPCION (IED)", sede: "", jornada: "MAÑANA", clase: "902", grado: "9", dane: "111001086754" },
    { colegio: "COLEGIO BOSANOVA (IED)", sede: "BOSANOVA", jornada: "TARDE", clase: "702", grado: "7", dane: "21110200099501" },
    { colegio: "COLEGIO FERNANDO MAZUERA VILLEGAS (IED)", sede: "FERNANDO MAZUERA VILLEGAS", jornada: "TARDE", clase: "9908", grado: "99", dane: "11110200075301" },
    { colegio: "COLEGIO PABLO DE TARSO (IED)", sede: "PABLO DE TARSO", jornada: "TARDE", clase: "9903", grado: "99", dane: "11110200028101" },
    { colegio: "COLEGIO SOLEDAD ACOSTA DE SAMPER (IED)", sede: "COLEGIO SOLEDAD ACOSTA DE SAMPER (IED) - SEDE PRINCIPAL", jornada: "ÚNICA", clase: "701", grado: "7", dane: "11100180039201" }
  ],
  "CIUDAD BOLIVAR": [
    { colegio: "COLEGIO CIUDAD DE MONTREAL (IED)", sede: "CIUDAD DE MONTREAL", jornada: "ÚNICA", clase: "901", grado: "9", dane: "11100102826601" },
    { colegio: "COLEGIO COMPARTIR RECUERDO (IED)", sede: "COMPARTIR LUCERO ALTO", jornada: "MAÑANA", clase: "701", grado: "7", dane: "11100103475401" },
    { colegio: "COLEGIO EL ENSUEÑO (IED)", sede: "COLEGIO EL ENSUEÑO (IED) - SEDE PRINCIPAL", jornada: "ÚNICA", clase: "701", grado: "7", dane: "11100180041401" },
    { colegio: "COLEGIO EL MINUTO DE BUENOS AIRES (IED)", sede: "MINUTO DE MARIA", jornada: "ÚNICA", clase: "702", grado: "7", dane: "11100108676202" },
    { colegio: "COLEGIO LA ESTANCIA - SAN ISIDRO LABRADOR (IED)", sede: "LA ESTANCIA", jornada: "MAÑANA", clase: "903", grado: "9", dane: "11100109241001" },
    { colegio: "COLEGIO LA JOYA (IED)", sede: "LA JOYA", jornada: "ÚNICA", clase: "801", grado: "8", dane: "11100109897301" },
    { colegio: "COLEGIO RODRIGO LARA BONILLA (IED)", sede: "RODRIGO LARA BONILLA", jornada: "TARDE", clase: "705", grado: "7", dane: "11100103678101" },
    { colegio: "COLEGIO SIERRA MORENA (IED)", sede: "SIERRA MORENA", jornada: "MAÑANA", clase: "802", grado: "8", dane: "11100108683501" }
  ],
  "ENGATIVA": [
    { colegio: "COLEGIO JOSE ASUNCION SILVA (IED)", sede: "", jornada: "ÚNICA", clase: "802", grado: "8", dane: "111001011771" },
    { colegio: "COLEGIO NESTOR FORERO ALCALA (IED)", sede: "", jornada: "ÚNICA", clase: "701", grado: "7", dane: "111001035521" },
    { colegio: "COLEGIO INSTITUTO TECNICO DISTRITAL REPUBLICA DE GUATEMALA (IED)", sede: "REPUBLICA DE GUATEMALA", jornada: "MAÑANA", clase: "701", grado: "7", dane: "11100103662501" },
    { colegio: "COLEGIO INSTITUTO TECNICO JUAN DEL CORRAL (IED)", sede: "JUAN DEL CORRAL", jornada: "ÚNICA", clase: "701", grado: "7", dane: "11100100958001" },
    { colegio: "COLEGIO JORGE GAITAN CORTES (IED)", sede: "ANDALUCIA", jornada: "MAÑANA", clase: "901", grado: "9", dane: "11100101580603" },
    { colegio: "COLEGIO MANUELA AYALA DE GAITAN (IED)", sede: "MANUELA AYALA DE GAITAN", jornada: "ÚNICA", clase: "703", grado: "7", dane: "11100104629901" },
    { colegio: "COLEGIO MIGUEL ANTONIO CARO (IED)", sede: "MIGUEL ANTONIO CARO", jornada: "MAÑANA", clase: "702", grado: "7", dane: "11100101107001" },
    { colegio: "COLEGIO NACIONES UNIDAS (IED)", sede: "JAIRO ANIBAL NIÑO", jornada: "ÚNICA", clase: "701", grado: "7", dane: "11100101329302" },
    { colegio: "COLEGIO NIDIA QUINTERO DE TURBAY (IED)", sede: "NIDYA QUINTERO DE TURBAY", jornada: "ÚNICA", clase: "701", grado: "7", dane: "11126500040801" },
    { colegio: "COLEGIO REPUBLICA DE COLOMBIA (IED)", sede: "REPUBLICA DE COLOMBIA", jornada: "ÚNICA", clase: "805", grado: "8", dane: "11100100997101" },
    { colegio: "COLEGIO ROBERT F. KENNEDY (IED)", sede: "ROBERT F. KENNEDY", jornada: "MAÑANA", clase: "701", grado: "7", dane: "11100100952101" },
    { colegio: "COLEGIO SAN JOSE NORTE (IED)", sede: "SAN JOSE NORTE", jornada: "ÚNICA", clase: "801", grado: "8", dane: "11100101245901" },
    { colegio: "COLEGIO TABORA (IED)", sede: "TABORA", jornada: "ÚNICA", clase: "701", grado: "7", dane: "11100101248301" }
  ],
  "FONTIBON": [
    { colegio: "COLEGIO ATAHUALPA (IED)", sede: "", jornada: "ÚNICA", clase: "703", grado: "7", dane: "111279001296" },
    { colegio: "COLEGIO INTEGRADO DE FONTIBON IBEP (IED)", sede: "", jornada: "MAÑANA", clase: "803", grado: "8", dane: "111279000966" },
    { colegio: "COLEGIO ANTONIO VAN UDEN (IED)", sede: "ANTONIO VAN UDEN", jornada: "TARDE", clase: "701", grado: "7", dane: "11127900006101" },
    { colegio: "COLEGIO COSTA RICA (IED)", sede: "REPUBLICA DE COSTA RICA", jornada: "MAÑANA", clase: "902", grado: "9", dane: "11127900036201" },
    { colegio: "COLEGIO LA FELICIDAD (IED)", sede: "LA FELICIDAD", jornada: "ÚNICA", clase: "702", grado: "7", dane: "11100180009101" },
    { colegio: "COLEGIO RODRIGO ARENAS BETANCOURT (IED)", sede: "RODRIGO ARENAS BETANCOURT", jornada: "MAÑANA", clase: "701", grado: "7", dane: "11100101434601" }
  ],
  "KENNEDY": [
    { colegio: "COLEGIO LA AMISTAD (IED)", sede: "", jornada: "MAÑANA", clase: "701", grado: "7", dane: "111001011690" },
    { colegio: "COLEGIO KENNEDY (IED)", sede: "", jornada: "ÚNICA", clase: "703", grado: "7", dane: "111001016292" },
    { colegio: "COLEGIO SAN PEDRO CLAVER (IED)", sede: "", jornada: "TARDE", clase: "701", grado: "7", dane: "111001013102" },
    { colegio: "COLEGIO EDUARDO UMAÑA LUNA (IED)", sede: "", jornada: "TARDE", clase: "701", grado: "7", dane: "111001098906" },
    { colegio: "COLEGIO CASTILLA (IED)", sede: "", jornada: "TARDE", clase: "703", grado: "7", dane: "111001076767" },
    { colegio: "COLEGIO ALFONSO LOPEZ PUMAREJO (IED)", sede: "ALFONSO LOPEZ PUMAREJO", jornada: "MAÑANA", clase: "901", grado: "9", dane: "11100108664901" },
    { colegio: "COLEGIO ALQUERIA DE LA FRAGUA (IED)", sede: "ALQUERIA DE LA FRAGUA", jornada: "TARDE", clase: "702", grado: "7", dane: "11100101609801" },
    { colegio: "COLEGIO CODEMA (IED)", sede: "CODEMA", jornada: "TARDE", clase: "704", grado: "7", dane: "11100110455801" },
    { colegio: "COLEGIO GABRIEL BETANCOURT MEJIA (IED)", sede: "SEDE A - GABRIEL BETANCOURT MEJIA", jornada: "TARDE", clase: "801", grado: "8", dane: "11100110428101" },
    { colegio: "COLEGIO ISABEL II (IED)", sede: "ISABEL II", jornada: "MAÑANA", clase: "802", grado: "8", dane: "11100101607101" },
    { colegio: "COLEGIO LA CHUCUA (IED)", sede: "LA CHUCUA", jornada: "TARDE", clase: "702", grado: "7", dane: "11100101613601" },
    { colegio: "COLEGIO NELSON MANDELA (IED)", sede: "NELSON MANDELA", jornada: "MAÑANA", clase: "701", grado: "7", dane: "11100111047701" },
    { colegio: "COLEGIO PAULO VI (IED)", sede: "PAULO VI", jornada: "TARDE", clase: "902", grado: "9", dane: "11100101315301" },
    { colegio: "COLEGIO PROSPERO PINZON (IED)", sede: "PROSPERO PINZON", jornada: "ÚNICA", clase: "803", grado: "8", dane: "11100102730801" },
    { colegio: "COLEGIO SAN RAFAEL (IED)", sede: "SAN RAFAEL", jornada: "MAÑANA", clase: "902", grado: "9", dane: "11100101317001" }
  ],
  "LA CANDELARIA": [
    { colegio: "COLEGIO ESCUELA NACIONAL DE COMERCIO (IED)", sede: "ESCUELA NACIONAL DE COMERCIO", jornada: "ÚNICA", clase: "802", grado: "8", dane: "11100101337401" }
  ],
  "LOS MARTIRES": [
    { colegio: "COLEGIO EDUARDO SANTOS (IED)", sede: "EDUARDO SANTOS", jornada: "ÚNICA", clase: "801", grado: "8", dane: "11100101400101" },
    { colegio: "COLEGIO SAN FRANCISCO DE ASIS (IED)", sede: "POLITECNICO NACIONAL FEMENINO", jornada: "ÚNICA", clase: "701", grado: "7", dane: "11100101677201" },
    { colegio: "COLEGIO TECNICO MENORAH (IED)", sede: "MENORAH", jornada: "ÚNICA", clase: "901", grado: "9", dane: "11100102606901" }
  ],
  "PUENTE ARANDA": [
    { colegio: "COLEGIO JULIO GARAVITO ARMERO (IED)", sede: "", jornada: "ÚNICA", clase: "902", grado: "9", dane: "111001014885" },
    { colegio: "COLEGIO DE CULTURA POPULAR (IED)", sede: "", jornada: "ÚNICA", clase: "802", grado: "8", dane: "111001000078" },
    { colegio: "COLEGIO LA MERCED (IED)", sede: "LA MERCED", jornada: "ÚNICA", clase: "802", grado: "8", dane: "11100100612201" },
    { colegio: "COLEGIO LUIS VARGAS TEJADA (IED)", sede: "LUIS VARGAS TEJADA", jornada: "ÚNICA", clase: "902", grado: "9", dane: "11100101486901" },
    { colegio: "COLEGIO MARCO ANTONIO CARREÑO SILVA (IED)", sede: "EL REMANSO", jornada: "ÚNICA", clase: "903", grado: "9", dane: "11100101482601" }
  ],
  "RAFAEL URIBE URIBE": [
    { colegio: "COLEGIO ALFREDO IRIARTE (IED)", sede: "CHIRCALES", jornada: "ÚNICA", clase: "903", grado: "9", dane: "11100102738301" },
    { colegio: "COLEGIO EL LIBERTADOR (IED)", sede: "EL LIBERTADOR", jornada: "ÚNICA", clase: "901", grado: "9", dane: "11100101466401" },
    { colegio: "COLEGIO MARIA CANO (IED)", sede: "MARIA CANO", jornada: "ÚNICA", clase: "701", grado: "7", dane: "11100110779401" },
    { colegio: "COLEGIO MARRUECOS Y MOLINOS (IED)", sede: "MARRUECOS Y MOLINOS", jornada: "TARDE", clase: "703", grado: "7", dane: "11100107637601" },
    { colegio: "COLEGIO RAFAEL DELGADO SALGUERO (IED)", sede: "GENERAL PAEZ", jornada: "ÚNICA", clase: "801", grado: "8", dane: "11100101297101" },
    { colegio: "COLEGIO SAN AGUSTIN (IED)", sede: "SAN AGUSTIN", jornada: "MAÑANA", clase: "803", grado: "8", dane: "11100101381101" }
  ],
  "SAN CRISTOBAL": [
    { colegio: "COLEGIO ALTAMIRA SUR ORIENTAL (IED)", sede: "", jornada: "MAÑANA", clase: "803", grado: "8", dane: "111001014168" },
    { colegio: "COLEGIO ALEMANIA UNIFICADA (IED)", sede: "GUACAMAYAS", jornada: "ÚNICA", clase: "9903", grado: "99", dane: "11100103086401" },
    { colegio: "COLEGIO ATENAS (IED)", sede: "ATENAS", jornada: "MAÑANA", clase: "801", grado: "8", dane: "11100101830901" },
    { colegio: "COLEGIO GLORIA VALENCIA DE CASTAÑO (IED)", sede: "COLEGIO GLORIA VALENCIA DE CASTAÑO (IED)", jornada: "ÚNICA", clase: "702", grado: "7", dane: "11100180104701" },
    { colegio: "COLEGIO JOSE ACEVEDO Y GOMEZ (IED)", sede: "JOSE ACEVEDO Y GOMEZ", jornada: "ÚNICA", clase: "901", grado: "9", dane: "11100101445101" },
    { colegio: "COLEGIO JUANA ESCOBAR (IED)", sede: "JUANA ESCOBAR", jornada: "MAÑANA", clase: "903", grado: "9", dane: "11100101233501" },
    { colegio: "COLEGIO LA BELLEZA LOS LIBERTADORES (IED)", sede: "LA BELLEZA", jornada: "TARDE", clase: "9903", grado: "99", dane: "11100101600401" },
    { colegio: "COLEGIO LA VICTORIA (IED)", sede: "LA VICTORIA", jornada: "MAÑANA", clase: "801", grado: "8", dane: "11100101836801" },
    { colegio: "COLEGIO MORALBA SURORIENTAL (IED)", sede: "MORALBA SURORIENTAL", jornada: "ÚNICA", clase: "802", grado: "8", dane: "11100102468601" },
    { colegio: "COLEGIO NUEVA ROMA (IED)", sede: "COLEGIO NUEVA ROMA (IED) - SEDE PRINCIPAL", jornada: "ÚNICA", clase: "802", grado: "8", dane: "11100109881701" },
    { colegio: "COLEGIO REPUBLICA DEL ECUADOR (IED)", sede: "REPUBLICA DEL ECUADOR", jornada: "ÚNICA", clase: "801", grado: "8", dane: "11100103243301" }
  ],
  "SANTAFE": [
    { colegio: "COLEGIO EL VERJON (IED)", sede: "EL VERJON ALTO", jornada: "ÚNICA", clase: "702", grado: "7", dane: "21100102748501" },
    { colegio: "COLEGIO MANUEL ELKIN PATARROYO (IED)", sede: "MANUEL ELKIN PATARROYO", jornada: "ÚNICA", clase: "801", grado: "8", dane: "11100109490101" },
    { colegio: "COLEGIO POLICARPA SALAVARRIETA (IED)", sede: "POLICARPA SALAVARRIETA", jornada: "ÚNICA", clase: "802", grado: "8", dane: "11100100983101" }
  ],
  "SUBA": [
    { colegio: "COLEGIO NUEVA ZELANDIA (IED)", sede: "", jornada: "TARDE", clase: "902", grado: "9", dane: "111769001871" },
    { colegio: "COLEGIO VILLA ELISA (IED)", sede: "", jornada: "TARDE", clase: "703", grado: "7", dane: "111769003122" },
    { colegio: "COLEGIO COMPARTIR SUBA (IED)", sede: "COMPARTIR SUBA", jornada: "ÚNICA", clase: "703", grado: "7", dane: "11100180081301" },
    { colegio: "COLEGIO DELIA ZAPATA OLIVELLA (IED)", sede: "DELIA ZAPATA OLIVELLA", jornada: "TARDE", clase: "701", grado: "7", dane: "11100110425601" },
    { colegio: "COLEGIO GUSTAVO MORALES MORALES (IED)", sede: "GUSTAVO MORALES MORALES", jornada: "MAÑANA", clase: "702", grado: "7", dane: "11100107551501" },
    { colegio: "COLEGIO INSTITUTO TECNICO DISTRITAL JULIO FLOREZ (IED)", sede: "JULIO FLOREZ", jornada: "ÚNICA", clase: "902", grado: "9", dane: "11100101577602" },
    { colegio: "COLEGIO RAMON DE ZUBIRIA (IED)", sede: "RAMON DE ZUBIRIA", jornada: "MAÑANA", clase: "802", grado: "8", dane: "11100108666501" },
    { colegio: "COLEGIO REPUBLICA DOMINICANA (IED)", sede: "REPUBLICA DOMINICANA", jornada: "MAÑANA", clase: "702", grado: "7", dane: "11176900336001" }
  ],
  "TUNJUELITO": [
    { colegio: "COLEGIO CIUDAD DE BOGOTA (IED)", sede: "CIUDAD DE BOGOTA", jornada: "MAÑANA", clase: "702", grado: "7", dane: "11100101421401" },
    { colegio: "COLEGIO RUFINO JOSE CUERVO (IED)", sede: "RUFINO JOSE CUERVO", jornada: "TARDE", clase: "805", grado: "8", dane: "11100101820101" },
    { colegio: "COLEGIO VENECIA (IED)", sede: "VENECIA", jornada: "MAÑANA", clase: "705", grado: "7", dane: "11100101025101" }
  ],
  "USME": [
    { colegio: "COLEGIO GABRIEL GARCIA MARQUEZ (IED)", sede: "", jornada: "ÚNICA", clase: "801", grado: "8", dane: "211001032501" },
    { colegio: "COLEGIO TENERIFE - GRANADA SUR (IED)", sede: "", jornada: "MAÑANA", clase: "801", grado: "8", dane: "211850000787" },
    { colegio: "COLEGIO CIUDAD CHENGDU (IED)", sede: "", jornada: "ÚNICA", clase: "701", grado: "7", dane: "111001800660" },
    { colegio: "COLEGIO LOS COMUNEROS - OSWALDO GUAYASAMIN (IED)", sede: "", jornada: "MAÑANA", clase: "801", grado: "8", dane: "111001044270" },
    { colegio: "COLEGIO ORLANDO FALS BORDA (IED)", sede: "", jornada: "TARDE", clase: "901", grado: "9", dane: "111001016039" },
    { colegio: "COLEGIO EL CORTIJO - VIANEY (IED)", sede: "EL CORTIJO", jornada: "ÚNICA", clase: "802", grado: "8", dane: "11185000138001" },
    { colegio: "COLEGIO EL UVAL (IED)", sede: "RURAL EL UVAL", jornada: "TARDE", clase: "701", grado: "7", dane: "21185000098101" },
    { colegio: "COLEGIO FEDERICO GARCIA LORCA (IED)", sede: "FEDERICO GARCIA LORCA", jornada: "ÚNICA", clase: "902", grado: "9", dane: "11185000157601" },
    { colegio: "COLEGIO LUIS EDUARDO MORA OSEJO (IED)", sede: "LUIS EDUARDO MORA OSEJO", jornada: "MAÑANA", clase: "702", grado: "7", dane: "11100109886801" },
    { colegio: "COLEGIO MIGUEL DE CERVANTES SAAVEDRA (IED)", sede: "MIGUEL DE CERVANTES SAAVEDRA", jornada: "MAÑANA", clase: "701", grado: "7", dane: "11100108301101" }
  ],
  "USAQUEN": [
    { colegio: "COLEGIO TOBERIN (IED)", sede: "", jornada: "MAÑANA", clase: "801", grado: "8", dane: "111001046957" },
  ],
};
