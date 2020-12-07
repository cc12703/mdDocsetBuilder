

import * as sqlite from 'sqlite3'



export function getCurRunPath(): string {
    return (process.env.RUN_PATH) ? process.env.RUN_PATH : process.cwd()
}



export function openDatabase(dbFile: string): Promise<sqlite.Database> {
    return new Promise((resolve, reject) => {
        const db = new sqlite.Database(dbFile, (error)=> {
            if(error) {
                reject(error)
            }
            else { 
                resolve(db)
            }
        })
    })
}

export function closeDatabase(db: sqlite.Database): Promise<boolean> {
    return new Promise((resolve, reject) => {
        db.close((error)=> {
            error ? reject(error) : resolve(true)
        })
    });
}

export function runSqlInDatabase(db: sqlite.Database, sql: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        db.run(sql, (error)=> {
            error ? reject(error) : resolve(true)
        })
    });
}

export function exceSqlInDatabase(db: sqlite.Database, sql: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        db.exec(sql, (error)=> {
            error ? reject(error) : resolve(true)
        })
    });
}