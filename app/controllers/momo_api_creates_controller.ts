import env from '#start/env'
import type { HttpContext } from '@adonisjs/core/http'

class ApiService {
  /** UUIDv4 généré via https://www.uuidgenerator.net/version4 pour assurer un identifiant unique.
   */
  private userId: string = env.get('USERID')
  private subscription_key: string = env.get('API_PRIMARY')

  /** Utilisation de Ngrok pour générer un nom de domaine temporaire permettant d'exposer un serveur local sur Internet. */
  private callback: string = 'https://...............ngrok-free.app/'
  private PRIMARY_KEY = env.get('API_PRIMARY')

  createUserId() {
    const url = 'https://sandbox.momodeveloper.mtn.com/v1_0/apiuser'
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Reference-Id': this.userId,
        'Ocp-Apim-Subscription-Key': this.PRIMARY_KEY,
      },
      body: JSON.stringify({
        providerCallbackHost: this.callback,
      }),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = {
            status: res.status,
            message: res.statusText,
            apiUser: res.headers.get('request-context'),
          }
          return data
        } else {
          throw new Error(`Erreur HTTP: ${res.status} - ${res.statusText}`)
        }
      })
      .then((data) => console.log('Réponse :', data))
      .catch((err) => console.error('Erreur :', err))
  }

  async getApiKey() {
    const url = `https://sandbox.momodeveloper.mtn.com/v1_0/apiuser/${this.userId}/apikey`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.PRIMARY_KEY,
      },
    })
    if (response.ok) {
      const apiKey = (await response.json()) as { apiKey: string }
      return apiKey
    } else {
      throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}`)
    }
  }

  async accessToken() {
    const data = await this.getApiKey()

    const str = `${this.userId}:${data.apiKey}`
    const encodedCredentials = Buffer.from(str).toString('base64')

    const response = await fetch('https://sandbox.momodeveloper.mtn.com/collection/token/', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${encodedCredentials}`,
        'Ocp-Apim-Subscription-Key': this.PRIMARY_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })

    if (!response.ok) {
      throw new Error(`Échec de l'obtention du token OAuth2 : ${response.statusText}`)
    }

    const doc = (await response.json()) as {
      access_token: string
      token_type: string
      expires_in: number
    }
    return { token: doc, encodedCredentials: encodedCredentials }
  }

  async bcAutorized() {
    try {
      const doc = (await this.accessToken()).token
      const msisdn = '242060000001'

      const body = new URLSearchParams()
      body.append('scope', 'profile')
      body.append('access_type', 'offline')
      body.append('login_hint', `ID:${msisdn}/MSISDN`)

      // Faire la requête POST à /bc-authorize
      const response = await fetch(
        'https://sandbox.momodeveloper.mtn.com/collection/v1_0/bc-authorize',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${doc.access_token}`,
            'Ocp-Apim-Subscription-Key': this.subscription_key,
            'X-Target-Environment': 'sandbox',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
        }
      )

      if (!response.ok) {
        throw new Error(`Échec de bc-authorize : ${response.statusText}`)
      }

      const data = (await response.json()) as {
        auth_req_id: string
        expires_in: number
        interval: number
      }
      return data
    } catch (error) {
      console.error('Erreur dans bcAuthorize:', error)
      throw error
    }
  }

  async createOauth2Token() {
    const authReqId = await this.bcAutorized()
    const encodedCredentials = (await this.accessToken()).encodedCredentials

    const body = new URLSearchParams()
    body.append('grant_type', 'urn:openid:params:grant-type:ciba')
    body.append('auth_req_id', authReqId.auth_req_id)

    const response = await fetch('https://sandbox.momodeveloper.mtn.com/collection/oauth2/token/', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${encodedCredentials}`,
        'Ocp-Apim-Subscription-Key': this.PRIMARY_KEY,
        'X-Target-Environment': 'sandbox',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      throw new Error(`Échec de l'obtention du token OAuth2 : ${response.statusText}`)
    }

    const doc = (await response.json()) as {
      access_token: string
      token_type: string
      expires_in: number
      scope: string
      refresh_token: string
      refresh_token_expires_in: number
    }
    return doc
  }

  async preApproval() {
    const doc = (await this.accessToken()).token
    const externalId = crypto.randomUUID() // Génère un ID unique
    const partyIdType = 'MSISDN'
    const partyId = '242060000001'
    const body = {
      payer: {
        partyIdType,
        partyId,
      },
      payerCurrency: 'EUR',
      payerMessage: 'Pré-approbation de paiement',
      validityTime: 3600,
    }
    const PRIMARY_KEY = env.get('API_PRIMARY')
    const response = await fetch(
      'https://sandbox.momodeveloper.mtn.com/collection/v2_0/preapproval',
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'Authorization': `Bearer ${doc.access_token}`,
          'X-Reference-Id': externalId.toString(),
          'X-Target-Environment': 'sandbox',
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': PRIMARY_KEY,
        },
      }
    )

    if (response.status === 409) {
      const details = this.getPreApprovalStatus(doc.access_token, PRIMARY_KEY, partyIdType, partyId)
      return details
    }

    if (response.ok) {
      const details = this.getPreApprovalStatus(doc.access_token, PRIMARY_KEY, partyIdType, partyId)
      return details
    } else {
      throw new Error('error pre Approval:')
    }
  }

  async getPreApprovalStatus(
    accesTokent: string,
    primaryKey: string,
    partyIdType: string,
    partyId: string
  ) {
    const response = await fetch(
      `https://sandbox.momodeveloper.mtn.com/collection/v1_0/preapprovals/${partyIdType}/${partyId}`,
      {
        headers: {
          'Authorization': `Bearer ${accesTokent}`,
          'X-Target-Environment': 'sandbox',
          'Ocp-Apim-Subscription-Key': primaryKey,
        },
      }
    )

    if (response.ok) {
      const data = (await response.json()) as {
        preApprovalDetails: [
          {
            preApprovalId: string
            toFri: string
            fromFri: string
            fromCurrency: string
            createdTime: string
            approvedTime: string
            expiryTime: string
            status: string
            message: string
          },
        ]
      }
      return data.preApprovalDetails.map((detail) => detail)[0]
    } else {
      throw new Error(`error getPreApprovalStatus : ${response.text()}`)
    }
  }

  async getUserInfoWithConsent() {
    const access_token = await this.createOauth2Token()
    const url = 'https://sandbox.momodeveloper.mtn.com/collection/oauth2/v1_0/userinfo'
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${access_token.access_token}`,
        'X-Target-Environment': 'sandbox',
        'Cache-Control': 'no-cache',
        'Ocp-Apim-Subscription-Key': this.PRIMARY_KEY,
      },
    })

    if (response.ok) {
      const data = await response.json()
      console.log(data)
      return data
    } else {
      throw new Error('error')
    }
  }

  async requesttoPay() {
    const { preApprovalId } = await this.preApproval()
    const doc = (await this.accessToken()).token
    const url = 'https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay'
    const externalId = crypto.randomUUID() // Génère un ID unique
    const partyIdType = 'MSISDN'
    const partyId = '242060000001'

    const body = {
      amount: '1000',
      currency: 'EUR',
      externalId: preApprovalId,
      payer: {
        partyIdType,
        partyId,
      },
      payerMessage: 'Paiement pour facture X',
      payeeNote: 'Note de paiement pour le bénéficiaire',
    }

    const PRIMARY_KEY = env.get('API_PRIMARY')
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Authorization': `Bearer ${doc.access_token}`,
        'X-Reference-Id': externalId.toString(),
        'X-Target-Environment': 'sandbox',
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': PRIMARY_KEY,
      },
    })

    return {
      referenceId: externalId.toString(),
    }
    if (response.ok) {
      const data = await response.json()
      console.log(data)
      return
    } else {
      throw new Error('error requesttoPay')
    }
  }

  async checkPaymentStatus() {
    const id = (await this.requesttoPay())?.referenceId
    const doc = (await this.accessToken()).token
    const url = `https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay/${id}`
    const PRIMARY_KEY = env.get('API_PRIMARY')
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${doc.access_token}`,
        'X-Target-Environment': 'sandbox',
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': PRIMARY_KEY,
      },
    })
    if (response.ok) {
      const data = await response.json()
      console.log(data)
      console.log('Statut du paiement:', response.status)
    } else {
      console.error('Erreur lors de la récupération du statut', response.status)
    }
  }
}

export default class MomoApiCreatesController {
  async index({ view }: HttpContext) {
    const api = new ApiService()
    const data = await api.checkPaymentStatus()

    return view.render('pages/home')
  }
}
