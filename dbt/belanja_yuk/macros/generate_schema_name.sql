{#
  Custom schema name macro:
  Secara default dbt menggabungkan default_schema + custom_schema (misal: public_staging).
  Macro ini memastikan model masuk langsung ke schema yang diinginkan (staging, intermediate, marts).
#}
{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- set default_schema = target.schema -%}
    {%- if custom_schema_name is none -%}
        {{ default_schema }}
    {%- else -%}
        {{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}
