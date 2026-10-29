<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Reglas de negocio
    |--------------------------------------------------------------------------
    |
    | Porcentajes y reglas que se aplican al calculo de las analiticas.
    |
    */

    /*
    |--------------------------------------------------------------------------
    | Porcentaje del supervisor
    |--------------------------------------------------------------------------
    |
    | Parte que le corresponde al supervisor sobre el total de ventas de las
    | taquillas que tiene a su cargo. Por defecto, el 13%.
    |
    */

    'supervisor_share' => (float) env('SUPERVISOR_SHARE', 0.13),

    /*
    |--------------------------------------------------------------------------
    | Porcentaje de la agencia
    |--------------------------------------------------------------------------
    |
    | Parte que le corresponde a la agencia sobre el total de ventas de sus
    | taquillas. Por defecto, el 1.5%.
    |
    */

    'agency_share' => (float) env('AGENCY_SHARE', 0.015),

];
