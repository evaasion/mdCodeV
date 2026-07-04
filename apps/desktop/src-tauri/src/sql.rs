use mysql::prelude::*;
use mysql::{Opts, OptsBuilder, Pool, Row, Value};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::time::Instant;
use tauri::State;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SqlStatus {
    pub connected: bool,
    pub host: Option<String>,
    pub username: Option<String>,
    pub port: Option<u16>,
    pub database: Option<String>,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SqlConnectConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: Option<String>,
    pub database: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SqlQueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub affected_rows: u64,
    pub execution_time_ms: u64,
    pub truncated: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SqlScriptResult {
    pub statements_executed: u32,
    pub total_affected_rows: u64,
    pub execution_time_ms: u64,
    pub errors: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SqlTableDump {
    pub ddl: String,
    pub inserts: String,
    pub row_count: u32,
    pub truncated: bool,
}

#[derive(Clone)]
pub(crate) struct StoredSql {
    config: SqlConnectConfig,
    pool: Pool,
}

pub struct SqlState(pub Mutex<Option<StoredSql>>);

fn escape_identifier(name: &str) -> String {
    name.replace('`', "``")
}

fn build_opts(config: &SqlConnectConfig) -> Result<Opts, String> {
    let mut builder = OptsBuilder::new()
        .ip_or_hostname(Some(config.host.trim().to_string()))
        .tcp_port(config.port)
        .user(Some(config.username.trim().to_string()))
        .pass(config.password.clone());

    if let Some(database) = &config.database {
        let trimmed = database.trim();
        if !trimmed.is_empty() {
            builder = builder.db_name(Some(trimmed.to_string()));
        }
    }

    Ok(builder.into())
}

fn with_sql<T, F>(state: &SqlState, action: F) -> Result<T, String>
where
    F: FnOnce(&Pool) -> Result<T, String>,
{
    let guard = state.0.lock().map_err(|_| "État SQL indisponible".to_string())?;
    let stored = guard
        .as_ref()
        .ok_or_else(|| "Aucune connexion MySQL active".to_string())?;
    action(&stored.pool)
}

fn value_to_json(value: Value) -> serde_json::Value {
    match value {
        Value::NULL => serde_json::Value::Null,
        Value::Bytes(bytes) => {
            if let Ok(text) = String::from_utf8(bytes.clone()) {
                serde_json::Value::String(text)
            } else {
                serde_json::Value::String(format!("<binary {} bytes>", bytes.len()))
            }
        }
        Value::Int(number) => json!(number),
        Value::UInt(number) => json!(number),
        Value::Float(number) => serde_json::Number::from_f64(number as f64)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        Value::Double(number) => serde_json::Number::from_f64(number)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        Value::Date(year, month, day, hour, minute, second, micros) => {
            if hour == 0 && minute == 0 && second == 0 && micros == 0 {
                serde_json::Value::String(format!("{year:04}-{month:02}-{day:02}"))
            } else {
                serde_json::Value::String(format!(
                    "{year:04}-{month:02}-{day:02} {hour:02}:{minute:02}:{second:02}"
                ))
            }
        }
        Value::Time(neg, days, hours, minutes, seconds, micros) => serde_json::Value::String(
            format!(
                "{}{days:02}:{hours:02}:{minutes:02}:{seconds:02}.{micros:06}",
                if neg { "-" } else { "" }
            ),
        ),
    }
}

fn row_to_json(row: Row) -> Vec<serde_json::Value> {
    (0..row.len())
        .map(|index| {
            value_to_json(
                row.get::<Value, _>(index)
                    .unwrap_or(Value::NULL),
            )
        })
        .collect()
}

fn query_names(conn: &mut mysql::PooledConn, sql: String) -> Result<Vec<String>, String> {
    let rows: Vec<Row> = conn
        .query(sql)
        .map_err(|error| format!("Erreur SQL: {error}"))?;

    Ok(rows
        .into_iter()
        .filter_map(|row| row.get::<Option<String>, _>(0))
        .flatten()
        .collect())
}

#[tauri::command]
pub fn sql_connect(state: State<SqlState>, config: SqlConnectConfig) -> Result<SqlStatus, String> {
    if config.host.trim().is_empty() {
        return Err("Hôte MySQL requis".to_string());
    }
    if config.username.trim().is_empty() {
        return Err("Utilisateur MySQL requis".to_string());
    }

    let opts = build_opts(&config)?;
    let pool = Pool::new(opts).map_err(|error| format!("Connexion MySQL échouée: {error}"))?;
    let mut conn = pool
        .get_conn()
        .map_err(|error| format!("Connexion MySQL échouée: {error}"))?;
    conn.query_drop("SELECT 1")
        .map_err(|error| format!("Test MySQL échoué: {error}"))?;

    let status = SqlStatus {
        connected: true,
        host: Some(config.host.trim().to_string()),
        username: Some(config.username.trim().to_string()),
        port: Some(config.port),
        database: config
            .database
            .as_ref()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
    };

    *state
        .0
        .lock()
        .map_err(|_| "État SQL indisponible".to_string())? = Some(StoredSql { config, pool });

    Ok(status)
}

#[tauri::command]
pub fn sql_disconnect(state: State<SqlState>) -> Result<SqlStatus, String> {
    *state
        .0
        .lock()
        .map_err(|_| "État SQL indisponible".to_string())? = None;

    Ok(SqlStatus {
        connected: false,
        host: None,
        username: None,
        port: None,
        database: None,
    })
}

#[tauri::command]
pub fn sql_status(state: State<SqlState>) -> Result<SqlStatus, String> {
    let guard = state.0.lock().map_err(|_| "État SQL indisponible".to_string())?;
    let Some(stored) = guard.as_ref() else {
        return Ok(SqlStatus {
            connected: false,
            host: None,
            username: None,
            port: None,
            database: None,
        });
    };

    Ok(SqlStatus {
        connected: true,
        host: Some(stored.config.host.clone()),
        username: Some(stored.config.username.clone()),
        port: Some(stored.config.port),
        database: stored
            .config
            .database
            .as_ref()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
    })
}

#[tauri::command]
pub fn sql_query(
    state: State<SqlState>,
    sql: String,
    max_rows: Option<u32>,
) -> Result<SqlQueryResult, String> {
    let trimmed = sql.trim();
    if trimmed.is_empty() {
        return Err("Requête SQL vide".to_string());
    }

    let limit = max_rows.unwrap_or(500).clamp(1, 2000);

    with_sql(&state, |pool| {
        let started = Instant::now();
        let mut conn = pool
            .get_conn()
            .map_err(|error| format!("Connexion perdue: {error}"))?;

        let result = conn
            .query_iter(trimmed)
            .map_err(|error| format!("Erreur SQL: {error}"))?;

        let columns = result
            .columns()
            .as_ref()
            .iter()
            .map(|column| column.name_str().to_string())
            .collect::<Vec<_>>();

        let mut rows = Vec::new();
        let mut truncated = false;

        for row in result {
            let row = row.map_err(|error| format!("Lecture résultat: {error}"))?;
            if rows.len() >= limit as usize {
                truncated = true;
                break;
            }
            rows.push(row_to_json(row));
        }

        let affected_rows = conn.affected_rows();

        Ok(SqlQueryResult {
            columns,
            rows,
            affected_rows,
            execution_time_ms: started.elapsed().as_millis() as u64,
            truncated,
        })
    })
}

#[tauri::command]
pub fn sql_list_databases(state: State<SqlState>) -> Result<Vec<String>, String> {
    with_sql(&state, |pool| {
        let mut conn = pool
            .get_conn()
            .map_err(|error| format!("Connexion perdue: {error}"))?;
        query_names(&mut conn, "SHOW DATABASES".to_string())
    })
}

#[tauri::command]
pub fn sql_list_tables(state: State<SqlState>, database: String) -> Result<Vec<String>, String> {
    let database = database.trim();
    if database.is_empty() {
        return Err("Nom de base requis".to_string());
    }

    with_sql(&state, |pool| {
        let mut conn = pool
            .get_conn()
            .map_err(|error| format!("Connexion perdue: {error}"))?;
        let sql = format!("SHOW TABLES FROM `{}`", escape_identifier(database));
        query_names(&mut conn, sql)
    })
}

#[tauri::command]
pub fn sql_describe_table(
    state: State<SqlState>,
    database: String,
    table: String,
) -> Result<SqlQueryResult, String> {
    let database = database.trim();
    let table = table.trim();
    if database.is_empty() || table.is_empty() {
        return Err("Base et table requises".to_string());
    }

    let sql = format!(
        "DESCRIBE `{}`.`{}`",
        escape_identifier(database),
        escape_identifier(table)
    );
    sql_query(state, sql, Some(200))
}

fn json_to_sql_literal(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => "NULL".to_string(),
        serde_json::Value::Bool(flag) => {
            if *flag {
                "1".to_string()
            } else {
                "0".to_string()
            }
        }
        serde_json::Value::Number(number) => number.to_string(),
        serde_json::Value::String(text) => {
            format!("'{}'", text.replace('\\', "\\\\").replace('\'', "''"))
        }
        other => format!("'{}'", other.to_string().replace('\'', "''")),
    }
}

fn split_sql_statements(sql: &str) -> Vec<String> {
    let mut statements = Vec::new();
    let mut current = String::new();
    let mut in_single = false;
    let mut in_double = false;

    for ch in sql.chars() {
        match ch {
            '\'' if !in_double => in_single = !in_single,
            '"' if !in_single => in_double = !in_double,
            ';' if !in_single && !in_double => {
                let trimmed = current.trim();
                if !trimmed.is_empty() {
                    let without_comments = trimmed
                        .lines()
                        .filter(|line| !line.trim_start().starts_with("--"))
                        .collect::<Vec<_>>()
                        .join("\n")
                        .trim()
                        .to_string();
                    if !without_comments.is_empty() {
                        statements.push(without_comments);
                    }
                }
                current.clear();
                continue;
            }
            _ => {}
        }
        current.push(ch);
    }

    let trimmed = current.trim();
    if !trimmed.is_empty() {
        statements.push(trimmed.to_string());
    }

    statements
}

fn qualified_table(database: &str, table: &str) -> String {
    if database.is_empty() {
        format!("`{}`", escape_identifier(table))
    } else {
        format!(
            "`{}`.`{}`",
            escape_identifier(database),
            escape_identifier(table)
        )
    }
}

#[tauri::command]
pub fn sql_show_create_table(
    state: State<SqlState>,
    database: String,
    table: String,
) -> Result<String, String> {
    let database = database.trim().to_string();
    let table = table.trim().to_string();
    if table.is_empty() {
        return Err("Nom de table requis".to_string());
    }

    with_sql(&state, |pool| {
        let mut conn = pool
            .get_conn()
            .map_err(|error| format!("Connexion perdue: {error}"))?;
        let sql = if database.is_empty() {
            format!("SHOW CREATE TABLE `{}`", escape_identifier(&table))
        } else {
            format!(
                "SHOW CREATE TABLE `{}`.`{}`",
                escape_identifier(&database),
                escape_identifier(&table)
            )
        };

        let row: Option<Row> = conn
            .query_first(sql)
            .map_err(|error| format!("SHOW CREATE TABLE échoué: {error}"))?;

        row.and_then(|entry| entry.get::<Option<String>, _>(1))
            .flatten()
            .ok_or_else(|| "DDL introuvable".to_string())
    })
}

#[tauri::command]
pub fn sql_export_table_dump(
    state: State<SqlState>,
    database: String,
    table: String,
    max_rows: Option<u32>,
) -> Result<SqlTableDump, String> {
    let database = database.trim().to_string();
    let table = table.trim().to_string();
    if table.is_empty() {
        return Err("Nom de table requis".to_string());
    }

    let limit = max_rows.unwrap_or(1000).clamp(1, 10_000);
    let ddl = sql_show_create_table(state.clone(), database.clone(), table.clone())?;
    let select_sql = format!(
        "SELECT * FROM {} LIMIT {}",
        qualified_table(&database, &table),
        limit
    );
    let result = sql_query(state, select_sql, Some(limit))?;

    let table_ref = escape_identifier(&table);
    let columns = result
        .columns
        .iter()
        .map(|name| format!("`{}`", escape_identifier(name)))
        .collect::<Vec<_>>()
        .join(", ");

    let mut inserts = String::new();
    for row in &result.rows {
        let values = row.iter().map(json_to_sql_literal).collect::<Vec<_>>().join(", ");
        inserts.push_str(&format!("INSERT INTO `{table_ref}` ({columns}) VALUES ({values});\n"));
    }

    Ok(SqlTableDump {
        ddl,
        inserts,
        row_count: result.rows.len() as u32,
        truncated: result.truncated,
    })
}

#[tauri::command]
pub fn sql_execute_script(
    state: State<SqlState>,
    sql: String,
    use_transaction: Option<bool>,
) -> Result<SqlScriptResult, String> {
    let statements = split_sql_statements(&sql);
    if statements.is_empty() {
        return Err("Script SQL vide".to_string());
    }

    let use_transaction = use_transaction.unwrap_or(true);
    let started = Instant::now();

    with_sql(&state, |pool| {
        let mut conn = pool
            .get_conn()
            .map_err(|error| format!("Connexion perdue: {error}"))?;

        if use_transaction {
            conn.query_drop("START TRANSACTION")
                .map_err(|error| format!("START TRANSACTION échoué: {error}"))?;
        }

        let mut executed = 0u32;
        let mut total_affected = 0u64;
        let mut errors = Vec::new();

        for statement in statements {
            match conn.query_drop(&statement) {
                Ok(()) => {
                    executed += 1;
                    total_affected += conn.affected_rows();
                }
                Err(error) => {
                    errors.push(format!("{statement}\n→ {error}"));
                    if use_transaction {
                        let _ = conn.query_drop("ROLLBACK");
                    }
                    break;
                }
            }
        }

        if errors.is_empty() && use_transaction {
            conn.query_drop("COMMIT")
                .map_err(|error| format!("COMMIT échoué: {error}"))?;
        }

        Ok(SqlScriptResult {
            statements_executed: executed,
            total_affected_rows: total_affected,
            execution_time_ms: started.elapsed().as_millis() as u64,
            errors,
        })
    })
}

#[tauri::command]
pub fn sql_show_indexes(
    state: State<SqlState>,
    database: String,
    table: String,
) -> Result<SqlQueryResult, String> {
    let database = database.trim();
    let table = table.trim();
    if table.is_empty() {
        return Err("Nom de table requis".to_string());
    }

    let sql = if database.is_empty() {
        format!("SHOW INDEX FROM `{}`", escape_identifier(table))
    } else {
        format!(
            "SHOW INDEX FROM `{}`.`{}`",
            escape_identifier(database),
            escape_identifier(table)
        )
    };
    sql_query(state, sql, Some(200))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SqlAddColumnConfig {
    pub database: String,
    pub table: String,
    pub column_name: String,
    pub column_type: String,
    pub nullable: Option<bool>,
    pub default_value: Option<String>,
}

#[tauri::command]
pub fn sql_add_column(
    state: State<SqlState>,
    config: SqlAddColumnConfig,
) -> Result<SqlQueryResult, String> {
    let database = config.database.trim();
    let table = config.table.trim();
    let column_name = config.column_name.trim();
    let column_type = config.column_type.trim();

    if table.is_empty() || column_name.is_empty() || column_type.is_empty() {
        return Err("Table, nom et type de colonne requis".to_string());
    }

    let nullable = config.nullable.unwrap_or(true);
    let null_clause = if nullable { "" } else { " NOT NULL" };
    let default_clause = config
        .default_value
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(|value| format!(" DEFAULT {value}"))
        .unwrap_or_default();

    let sql = format!(
        "ALTER TABLE {} ADD COLUMN `{}` {}{}{}",
        qualified_table(database, table),
        escape_identifier(column_name),
        column_type,
        null_clause,
        default_clause
    );
    sql_query(state, sql, Some(1))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SqlIndexConfig {
    pub database: String,
    pub table: String,
    pub index_name: String,
    pub columns: Vec<String>,
    pub unique: Option<bool>,
}

#[tauri::command]
pub fn sql_create_index(
    state: State<SqlState>,
    config: SqlIndexConfig,
) -> Result<SqlQueryResult, String> {
    let database = config.database.trim();
    let table = config.table.trim();
    let index_name = config.index_name.trim();

    if table.is_empty() || index_name.is_empty() || config.columns.is_empty() {
        return Err("Table, nom d'index et colonnes requis".to_string());
    }

    let columns = config
        .columns
        .iter()
        .map(|name| format!("`{}`", escape_identifier(name.trim())))
        .collect::<Vec<_>>()
        .join(", ");

    let unique = if config.unique.unwrap_or(false) {
        "UNIQUE "
    } else {
        ""
    };

    let sql = format!(
        "CREATE {unique}INDEX `{}` ON {} ({columns})",
        escape_identifier(index_name),
        qualified_table(database, table)
    );
    sql_query(state, sql, Some(1))
}

#[tauri::command]
pub fn sql_drop_index(
    state: State<SqlState>,
    database: String,
    table: String,
    index_name: String,
) -> Result<SqlQueryResult, String> {
    let database = database.trim();
    let table = table.trim();
    let index_name = index_name.trim();

    if table.is_empty() || index_name.is_empty() {
        return Err("Table et nom d'index requis".to_string());
    }

    let sql = format!(
        "DROP INDEX `{}` ON {}",
        escape_identifier(index_name),
        qualified_table(database, table)
    );
    sql_query(state, sql, Some(1))
}